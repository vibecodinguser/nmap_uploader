import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import { isMapTabUrl, MAP_TAB_URL_PATTERN } from '@/lib/map_tab'
import { CLOSE_PANEL_SIDEBAR_ACTION } from '@/lib/panel_sidebar_notify'
import { reloadMapEditorTabs } from '@/lib/reload_editor_page'
import { uploadProcessedFilesToYandexDisk } from '@/lib/upload_service'
import {
  buildAuthPayload,
  clearAuth,
  ensureYandexAuth,
  getStoredAuth,
  loadUserAvatarDataUrl,
  type YandexUser,
} from '@/lib/yandex/client'

const PANEL_PAGE = '/panel.html'

type SidePanelApi = {
  open: (options: { windowId?: number; tabId?: number }) => Promise<void>
  setOptions: (options: { path: string; enabled?: boolean }) => Promise<void>
}

const getSidePanelApi = (): SidePanelApi | undefined => {
  const api = (browser as typeof browser & { sidePanel?: SidePanelApi }).sidePanel
  if (!api?.open) return undefined
  return api
}

type ToolbarActionApi = {
  onClicked: {
    addListener: (callback: (tab: Browser.tabs.Tab) => void) => void
  }
}

/** Chrome MV3 — `action`, Firefox MV2 — `browserAction`. */
const getToolbarActionApi = (): ToolbarActionApi | undefined => {
  if (browser.action?.onClicked) return browser.action

  const browserAction = (browser as typeof browser & { browserAction?: ToolbarActionApi })
    .browserAction
  if (browserAction?.onClicked) return browserAction

  return undefined
}

const PANEL_SIDEBAR_SCRIPT = '/content-scripts/panel-sidebar.js' as const
const MAP_HOME = 'https://n.maps.yandex.ru/' as const
const MAP_URL_PATTERN = MAP_TAB_URL_PATTERN
const PANEL_SIDEBAR_REGISTRATION_ID = 'nmap-panel-sidebar' as const

const UA_YANDEX_PATTERN = /YaBrowser|Yowser|YaSearchBrowser/i

/** Локальная копия для SW: при HMR импорт функций из lib/browser может «отвалиться». */
const detectYandexBrowserInServiceWorker = (): boolean => {
  if (UA_YANDEX_PATTERN.test(navigator.userAgent)) return true

  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData?.brands
  return Boolean(brands?.some(({ brand }) => /yandex/i.test(brand)))
}

const persistYandexBrowserFlag = async (): Promise<void> => {
  if (!detectYandexBrowserInServiceWorker()) return
  await browser.storage.local.set({ is_yandex_browser: true })
}

const readYandexUaFromTab = async (tabId: number): Promise<boolean> => {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => /YaBrowser|Yowser|YaSearchBrowser/i.test(navigator.userAgent),
    })
    return Boolean(injection?.result)
  } catch {
    return false
  }
}

const resolveIsYandexBrowser = async (): Promise<boolean> => {
  if (detectYandexBrowserInServiceWorker()) {
    await browser.storage.local.set({ is_yandex_browser: true })
    return true
  }

  const stored = await browser.storage.local.get('is_yandex_browser')
  if (stored.is_yandex_browser === true) return true

  const mapTabs = await browser.tabs.query({ url: MAP_URL_PATTERN })
  for (const mapTab of mapTabs) {
    if (!mapTab.id) continue
    if (await readYandexUaFromTab(mapTab.id)) {
      await browser.storage.local.set({ is_yandex_browser: true })
      return true
    }
  }

  return false
}

/** В Yandex Browser sidePanel API есть, но UI не отображается — используем injected sidebar. */
const shouldUseNativeSidePanel = async (): Promise<boolean> => {
  if (await resolveIsYandexBrowser()) return false
  return Boolean(getSidePanelApi())
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const sendTogglePanel = async (tabId: number): Promise<void> => {
  await browser.tabs.sendMessage(tabId, { action: 'togglePanel' })
}

const retrySendTogglePanel = async (tabId: number): Promise<boolean> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await sendTogglePanel(tabId)
      return true
    } catch {
      await sleep(150 * (attempt + 1))
    }
  }

  return false
}

const manifestIncludesPanelSidebar = (): boolean => {
  const entries = browser.runtime.getManifest().content_scripts ?? []
  return entries.some((entry) => entry.js?.some((path) => path.includes('panel-sidebar')))
}

const isDuplicateContentScriptIdError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('Duplicate script ID')

/** В dev-сборке WXT не добавляет content_scripts в manifest — регистрируем вручную. */
const registerPanelSidebarContentScript = async (): Promise<void> => {
  if (manifestIncludesPanelSidebar()) return

  const registered = await browser.scripting.getRegisteredContentScripts()
  if (registered.some((script) => script.id === PANEL_SIDEBAR_REGISTRATION_ID)) return

  try {
    await browser.scripting.registerContentScripts([
      {
        id: PANEL_SIDEBAR_REGISTRATION_ID,
        matches: ['https://n.maps.yandex.ru/*'],
        js: [PANEL_SIDEBAR_SCRIPT],
        runAt: 'document_idle',
      },
    ])
  } catch (error: unknown) {
    if (isDuplicateContentScriptIdError(error)) return
    throw error
  }
}

let panelSidebarRegistration: Promise<void> | undefined

const ensurePanelSidebarRegistered = (): Promise<void> => {
  if (!panelSidebarRegistration) {
    panelSidebarRegistration = registerPanelSidebarContentScript().catch((error: unknown) => {
      panelSidebarRegistration = undefined
      console.warn('[nmap_uploader] ensurePanelSidebarRegistered failed:', error)
    })
  }
  return panelSidebarRegistration
}

const waitForTabReady = async (tabId: number, maxMs = 15_000): Promise<Browser.tabs.Tab> => {
  const started = Date.now()

  while (Date.now() - started < maxMs) {
    const tab = await browser.tabs.get(tabId)
    if (tab.status === 'complete' && isMapTabUrl(tab.url)) return tab
    await sleep(150)
  }

  throw new Error('Страница n.maps.yandex.ru не успела загрузиться')
}

const focusTab = async (tab: Browser.tabs.Tab): Promise<void> => {
  if (!tab.id) return
  await browser.tabs.update(tab.id, { active: true })
  if (tab.windowId) {
    await browser.windows.update(tab.windowId, { focused: true })
  }
}

/** Вкладка n.maps для injected sidebar: текущая, другая в окне или новая. */
const resolveMapTargetTab = async (clickedTab: Browser.tabs.Tab): Promise<Browser.tabs.Tab> => {
  if (clickedTab.id && isMapTabUrl(clickedTab.url)) return clickedTab

  const tabsInWindow = await browser.tabs.query({
    url: MAP_URL_PATTERN,
    ...(clickedTab.windowId === undefined ? {} : { windowId: clickedTab.windowId }),
  })
  const mapTabInWindow = tabsInWindow.find((tab) => tab.id !== undefined)
  if (mapTabInWindow) {
    await focusTab(mapTabInWindow)
    return mapTabInWindow
  }

  const tabsAnywhere = await browser.tabs.query({ url: MAP_URL_PATTERN })
  const mapTabAnywhere = tabsAnywhere.find((tab) => tab.id !== undefined)
  if (mapTabAnywhere) {
    await focusTab(mapTabAnywhere)
    return mapTabAnywhere
  }

  const created = await browser.tabs.create({ url: MAP_HOME, active: true })
  if (!created.id) throw new Error('Не удалось открыть n.maps.yandex.ru')
  return waitForTabReady(created.id)
}

const toggleInjectedSidebar = async (tabId: number, tabUrl?: string) => {
  let url = tabUrl
  if (!isMapTabUrl(url)) {
    const tab = await browser.tabs.get(tabId)
    url = tab.url
  }

  if (!isMapTabUrl(url)) {
    throw new Error('Откройте n.maps.yandex.ru и нажмите иконку снова')
  }

  // content script может ещё инициализироваться после загрузки страницы
  if (await retrySendTogglePanel(tabId)) return

  await browser.scripting.executeScript({
    target: { tabId },
    files: [PANEL_SIDEBAR_SCRIPT],
  })

  if (await retrySendTogglePanel(tabId)) return

  throw new Error('Не удалось открыть панель на текущей вкладке')
}

type AuthMessageResponse = {
  ok: boolean
  user: YandexUser | null
  avatarDataUrl: string | null
  error?: string
}

const handleYandexAuthMessage = ({
  interactive,
  sendResponse,
  logLabel,
  cancelError,
}: {
  interactive: boolean
  sendResponse: (response: AuthMessageResponse) => void
  logLabel: string
  cancelError?: string
}) => {
  ensureYandexAuth({ interactive })
    .then(async (auth) => {
      if (!auth) {
        sendResponse({
          ok: false,
          user: null,
          avatarDataUrl: null,
          ...(cancelError ? { error: cancelError } : {}),
        })
        return
      }

      const avatarDataUrl = await loadUserAvatarDataUrl(auth.user)
      sendResponse({
        ok: true,
        user: auth.user,
        avatarDataUrl,
      })
    })
    .catch((error: unknown) => {
      console.error(`[nmap_uploader] ${logLabel} failed:`, error)
      sendResponse({
        ok: false,
        user: null,
        avatarDataUrl: null,
        error: error instanceof Error ? error.message : 'Ошибка авторизации',
      })
    })
}

const openInjectedPanel = async (tab: Browser.tabs.Tab) => {
  const targetTab = await resolveMapTargetTab(tab)
  if (!targetTab.id) throw new Error('Не удалось найти вкладку для панели')

  if (!isMapTabUrl(targetTab.url) || targetTab.status !== 'complete') {
    await waitForTabReady(targetTab.id)
  }

  const readyTab = await browser.tabs.get(targetTab.id)
  if (!readyTab.id) throw new Error('Не удалось найти вкладку для панели')
  await toggleInjectedSidebar(readyTab.id, readyTab.url)
}

const resolveClickedTab = async (tab: Browser.tabs.Tab): Promise<Browser.tabs.Tab | undefined> => {
  if (tab.id) return tab
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
  return activeTab
}

const openPanel = async (tab: Browser.tabs.Tab) => {
  const clickedTab = await resolveClickedTab(tab)
  if (!clickedTab?.id) return

  if (await resolveIsYandexBrowser()) {
    await openInjectedPanel(clickedTab)
    return
  }

  if ((await shouldUseNativeSidePanel()) && clickedTab.windowId) {
    const sidePanel = getSidePanelApi()
    try {
      await sidePanel?.setOptions({ path: PANEL_PAGE, enabled: true })
      await sidePanel?.open({ windowId: clickedTab.windowId })
      return
    } catch (error: unknown) {
      console.warn('[nmap_uploader] native sidePanel.open failed:', error)
    }
  }

  await openInjectedPanel(clickedTab)
}

// WXT подхватывает default export при сборке; статического import нет
// noinspection JSUnusedGlobalSymbols
export default defineBackground(() => {
  void persistYandexBrowserFlag()
  void ensurePanelSidebarRegistered()

  const toolbarAction = getToolbarActionApi()
  if (!toolbarAction) {
    console.error('[nmap_uploader] toolbar action API is unavailable in this browser')
  } else {
    toolbarAction.onClicked.addListener((tab) => {
      openPanel(tab).catch((error: unknown) => {
        console.error('[nmap_uploader] openPanel failed:', error)
      })
    })
  }

  browser.runtime.onInstalled.addListener(() => {
    void persistYandexBrowserFlag()
    void ensurePanelSidebarRegistered()

    void shouldUseNativeSidePanel().then((useNative) => {
      if (!useNative) return

      const sidePanel = getSidePanelApi()
      sidePanel?.setOptions({ path: PANEL_PAGE, enabled: true }).catch((error: unknown) => {
        console.warn('[nmap_uploader] sidePanel.setOptions failed:', error)
      })
    })
  })

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const action = message?.action as string | undefined

    if (action === 'getAuth') {
      getStoredAuth()
        .then((auth) => buildAuthPayload(auth))
        .then((payload) => sendResponse(payload))
        .catch(() => sendResponse({ user: null, avatarDataUrl: null }))
      return true
    }

    if (action === 'ensureAuth') {
      handleYandexAuthMessage({
        interactive: Boolean(message.interactive),
        sendResponse,
        logLabel: 'ensureAuth',
      })
      return true
    }

    if (action === 'login') {
      handleYandexAuthMessage({
        interactive: true,
        sendResponse,
        logLabel: 'login',
        cancelError: 'Авторизация отменена',
      })
      return true
    }

    if (action === 'logout') {
      clearAuth({ explicit: true })
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          console.error('[nmap_uploader] logout failed:', error)
          sendResponse({ ok: false })
        })
      return true
    }

    if (action === 'uploadProcessedFiles') {
      uploadProcessedFilesToYandexDisk({
        files: message.files ?? [],
        targetDate: message.targetDate,
      })
        .then((result) => sendResponse(result))
        .catch((error: unknown) => {
          console.error('[nmap_uploader] upload failed:', error)
          sendResponse({
            ok: false,
            processedCount: 0,
            skippedCount: 0,
            logs: [
              {
                id: crypto.randomUUID(),
                level: 'error',
                message: error instanceof Error ? error.message : 'Ошибка загрузки',
              },
            ],
          })
        })
      return true
    }

    if (action === 'reloadEditorPage') {
      reloadMapEditorTabs({ preferredTabId: _sender.tab?.id })
        .then((ok) => sendResponse({ ok }))
        .catch((error: unknown) => {
          console.warn('[nmap_uploader] reloadEditorPage failed:', error)
          sendResponse({ ok: false })
        })
      return true
    }

    if (action === GO_TO_REFRESH_ACTION) {
      const relayGoToRefresh = async (): Promise<void> => {
        const senderTabId = _sender.tab?.id
        const senderIsMapTab = _sender.tab?.url?.startsWith('https://n.maps.yandex.ru/')

        if (senderTabId && senderIsMapTab) {
          await browser.tabs.sendMessage(senderTabId, { action: GO_TO_REFRESH_ACTION })
          return
        }

        const tabs = await browser.tabs.query({ url: 'https://n.maps.yandex.ru/*' })
        await Promise.allSettled(
          tabs.map((tab) => {
            if (!tab.id) return Promise.resolve()
            return browser.tabs.sendMessage(tab.id, { action: GO_TO_REFRESH_ACTION })
          }),
        )
      }

      relayGoToRefresh()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          console.warn('[nmap_uploader] refreshGoToMenu relay failed:', error)
          sendResponse({ ok: false })
        })
      return true
    }

    if (action === CLOSE_PANEL_SIDEBAR_ACTION) {
      const relayClosePanelSidebar = async (): Promise<void> => {
        const senderTabId = _sender.tab?.id
        const senderIsMapTab = _sender.tab?.url?.startsWith('https://n.maps.yandex.ru/')

        if (senderTabId && senderIsMapTab) {
          await browser.tabs.sendMessage(senderTabId, { action: CLOSE_PANEL_SIDEBAR_ACTION })
          return
        }

        const tabs = await browser.tabs.query({ url: 'https://n.maps.yandex.ru/*' })
        await Promise.allSettled(
          tabs.map((tab) => {
            if (!tab.id) return Promise.resolve()
            return browser.tabs.sendMessage(tab.id, { action: CLOSE_PANEL_SIDEBAR_ACTION })
          }),
        )
      }

      relayClosePanelSidebar()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          console.warn('[nmap_uploader] closePanelSidebar relay failed:', error)
          sendResponse({ ok: false })
        })
      return true
    }

    if (action === 'applyStrokeColor') {
      const color = typeof message.color === 'string' ? message.color : ''
      if (!color) {
        sendResponse({ ok: false })
        return true
      }

      const relayStrokeColor = async (): Promise<void> => {
        const senderTabId = _sender.tab?.id
        const senderIsMapTab = _sender.tab?.url?.startsWith('https://n.maps.yandex.ru/')

        if (senderTabId && senderIsMapTab) {
          await browser.tabs.sendMessage(senderTabId, { action: 'applyStrokeColor', color })
          return
        }

        const tabs = await browser.tabs.query({ url: 'https://n.maps.yandex.ru/*' })
        await Promise.allSettled(
          tabs.map((tab) => {
            if (!tab.id) return Promise.resolve()
            return browser.tabs.sendMessage(tab.id, { action: 'applyStrokeColor', color })
          }),
        )
      }

      relayStrokeColor()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          console.warn('[nmap_uploader] applyStrokeColor relay failed:', error)
          sendResponse({ ok: false })
        })
      return true
    }

    return undefined
  })
})
