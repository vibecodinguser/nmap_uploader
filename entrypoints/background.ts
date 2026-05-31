import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { uploadProcessedFilesToYandexDisk } from '@/lib/upload_service'
import { clearAuth, ensureYandexAuth, getStoredAuth } from '@/lib/yandex/client'

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

/** В Yandex Browser sidePanel API есть, но UI не отображается — используем injected sidebar. */
const shouldUseNativeSidePanel = (): boolean => {
  if (navigator.userAgent.includes('YaBrowser')) return false
  return Boolean(getSidePanelApi())
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const sendTogglePanel = async (tabId: number): Promise<void> => {
  await browser.tabs.sendMessage(tabId, { action: 'togglePanel' })
}

const isRestrictedUrl = (url?: string) =>
  !url ||
  url.startsWith('chrome://') ||
  url.startsWith('chrome-extension://') ||
  url.startsWith('browser://') ||
  url.startsWith('about:') ||
  url.startsWith('edge://')

const toggleInjectedSidebar = async (tabId: number, tabUrl?: string) => {
  if (isRestrictedUrl(tabUrl)) {
    throw new Error('Панель недоступна на системных страницах браузера')
  }

  // content script может ещё инициализироваться после загрузки страницы
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await sendTogglePanel(tabId)
      return
    } catch {
      await sleep(120 * (attempt + 1))
    }
  }

  await browser.scripting.executeScript({
    target: { tabId },
    files: ['/content-scripts/panel-sidebar.js'],
  })

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await sendTogglePanel(tabId)
      return
    } catch {
      await sleep(120 * (attempt + 1))
    }
  }

  throw new Error('Не удалось открыть панель на текущей вкладке')
}

const openPanel = async (tab: Browser.tabs.Tab) => {
  if (!tab.id) return

  if (shouldUseNativeSidePanel() && tab.windowId) {
    const sidePanel = getSidePanelApi()
    try {
      await sidePanel?.setOptions({ path: PANEL_PAGE, enabled: true })
      await sidePanel?.open({ windowId: tab.windowId })
      return
    } catch (error: unknown) {
      console.warn('[nmap_uploader] native sidePanel.open failed:', error)
    }
  }

  await toggleInjectedSidebar(tab.id, tab.url)
}

// WXT подхватывает default export при сборке; статического import нет
// noinspection JSUnusedGlobalSymbols
export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    openPanel(tab).catch((error: unknown) => {
      console.error('[nmap_uploader] openPanel failed:', error)
    })
  })

  browser.runtime.onInstalled.addListener(() => {
    if (!shouldUseNativeSidePanel()) return

    const sidePanel = getSidePanelApi()
    sidePanel?.setOptions({ path: PANEL_PAGE, enabled: true }).catch((error: unknown) => {
      console.warn('[nmap_uploader] sidePanel.setOptions failed:', error)
    })
  })

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const action = message?.action as string | undefined

    if (action === 'getAuth') {
      getStoredAuth()
        .then((auth) => sendResponse({ user: auth?.user ?? null }))
        .catch(() => sendResponse({ user: null }))
      return true
    }

    if (action === 'ensureAuth') {
      const interactive = Boolean(message.interactive)
      ensureYandexAuth({ interactive })
        .then((auth) => sendResponse({ ok: Boolean(auth), user: auth?.user ?? null }))
        .catch((error: unknown) => {
          console.error('[nmap_uploader] ensureAuth failed:', error)
          sendResponse({
            ok: false,
            user: null,
            error: error instanceof Error ? error.message : 'Ошибка авторизации',
          })
        })
      return true
    }

    if (action === 'login') {
      ensureYandexAuth({ interactive: true })
        .then((auth) =>
          sendResponse({
            ok: Boolean(auth),
            user: auth?.user ?? null,
            error: auth ? undefined : 'Авторизация отменена',
          }),
        )
        .catch((error: unknown) => {
          console.error('[nmap_uploader] login failed:', error)
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Ошибка авторизации',
          })
        })
      return true
    }

    if (action === 'logout') {
      clearAuth()
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
