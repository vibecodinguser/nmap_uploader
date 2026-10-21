/**
 * Управление открытием панели расширения (Native SidePanel API или инжектируемый сайдбар).
 */
import { type Browser, browser } from 'wxt/browser'
import { detectYandexBrowserInPageContext, isYandexBrowser } from '@/lib/browser'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { isMapTabUrl, MAP_ORIGIN, MAP_TAB_URL_PATTERN } from '@/lib/map_tab'

export const PANEL_PAGE = '/panel.html'
export const PANEL_SIDEBAR_SCRIPT = '/content-scripts/panel-sidebar.js' as const
export const MAP_HOME = `${MAP_ORIGIN}/` as const
export const MAP_URL_PATTERN = MAP_TAB_URL_PATTERN
export const PANEL_SIDEBAR_REGISTRATION_ID = 'nmap-panel-sidebar' as const

export type SidePanelApi = {
  open: (options: { windowId?: number; tabId?: number }) => Promise<void>
  setOptions: (options: { path: string; enabled?: boolean }) => Promise<void>
}

export const getSidePanelApi = (): SidePanelApi | undefined => {
  return (browser as typeof browser & { sidePanel?: SidePanelApi }).sidePanel
}

export type ToolbarActionApi = {
  onClicked: {
    addListener: (callback: (tab: Browser.tabs.Tab) => void) => void
  }
}

export const getToolbarActionApi = (): ToolbarActionApi | undefined => {
  let result: ToolbarActionApi | undefined
  if (browser.action?.onClicked) {
    result = browser.action
  } else {
    const browserAction = (browser as typeof browser & { browserAction?: ToolbarActionApi })
      .browserAction
    if (browserAction?.onClicked) {
      result = browserAction
    }
  }
  return result
}

export const persistYandexBrowserFlag = async (): Promise<void> => {
  const yandexBrowser = isYandexBrowser()
  if (yandexBrowser) {
    await browser.storage.local.set({ is_yandex_browser: true })
  }
}

export const readYandexUaFromTab = async (tabId: number): Promise<boolean> => {
  let result = false
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: detectYandexBrowserInPageContext,
    })
    result = Boolean(injection?.result)
  } catch {
    // ignore errors
  }
  return result
}

export const checkTabsForYandexBrowser = async (): Promise<boolean> => {
  const mapTabs = await browser.tabs.query({ url: MAP_URL_PATTERN })
  for (const mapTab of mapTabs) {
    if (mapTab.id) {
      const tabIsYandex = await readYandexUaFromTab(mapTab.id)
      if (tabIsYandex) {
        return true
      }
    }
  }
  return false
}

export const resolveIsYandexBrowser = async (): Promise<boolean> => {
  if (isYandexBrowser()) {
    await browser.storage.local.set({ is_yandex_browser: true })
    return true
  }

  const stored = await browser.storage.local.get('is_yandex_browser')
  if (true === stored.is_yandex_browser) {
    return true
  }

  const foundInTabs = await checkTabsForYandexBrowser()
  if (foundInTabs) {
    await browser.storage.local.set({ is_yandex_browser: true })
    return true
  }

  return false
}

export const shouldUseNativeSidePanel = async (): Promise<boolean> => {
  const isYandex = await resolveIsYandexBrowser()
  const sidePanelApi = getSidePanelApi()
  let useNative = false
  if (!isYandex && sidePanelApi) {
    useNative = true
  }
  return useNative
}

export const sleep = (ms: number): Promise<void> => {
  const resolveAfterDelay = (resolve: () => void) => {
    setTimeout(resolve, ms)
  }
  return new Promise<void>(resolveAfterDelay)
}

export const sendTogglePanel = async (tabId: number): Promise<void> => {
  await browser.tabs.sendMessage(tabId, { action: 'togglePanel' })
}

export const retrySendTogglePanel = async (tabId: number): Promise<boolean> => {
  let succeeded = false
  const maxAttempts = 8
  for (let attempt = 0; attempt < maxAttempts && !succeeded; attempt += 1) {
    try {
      await sendTogglePanel(tabId)
      succeeded = true
    } catch {
      const delay = 150 * (attempt + 1)
      await sleep(delay)
    }
  }
  return succeeded
}

export const isPanelSidebarScript = (path: string): boolean => {
  return path.includes('panel-sidebar')
}

export const manifestIncludesPanelSidebar = (): boolean => {
  const entries = browser.runtime.getManifest().content_scripts ?? []
  const entryIncludesPanelSidebar = (entry: { js?: string[] }) =>
    entry.js?.some(isPanelSidebarScript) ?? false
  return entries.some(entryIncludesPanelSidebar)
}

export const isDuplicateContentScriptIdError = (error: unknown): boolean => {
  return error instanceof Error && error.message.includes('Duplicate script ID')
}

export const registerPanelSidebarContentScript = async (): Promise<void> => {
  if (!manifestIncludesPanelSidebar()) {
    const registered = await browser.scripting.getRegisteredContentScripts()
    const isRegisteredPanelSidebar = (script: { id: string }) =>
      script.id === PANEL_SIDEBAR_REGISTRATION_ID
    const isAlreadyRegistered = registered.some(isRegisteredPanelSidebar)
    if (!isAlreadyRegistered) {
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
        if (!isDuplicateContentScriptIdError(error)) {
          throw error
        }
      }
    }
  }
}

let panelSidebarRegistration: Promise<void> | undefined

export const handleEnsurePanelSidebarError = (error: unknown): void => {
  panelSidebarRegistration = undefined
  console.warn('[nmap_uploader] ensurePanelSidebarRegistered failed:', error)
}

export const registerPanelSidebarSafely = async (): Promise<void> => {
  try {
    await registerPanelSidebarContentScript()
  } catch (error: unknown) {
    handleEnsurePanelSidebarError(error)
  }
}

export const ensurePanelSidebarRegistered = (): Promise<void> => {
  panelSidebarRegistration ??= registerPanelSidebarSafely()
  return panelSidebarRegistration
}

export const waitForTabReady = async (tabId: number, maxMs = 15_000): Promise<Browser.tabs.Tab> => {
  const started = Date.now()
  const locale = await syncLocaleFromStorage()
  const t = createTranslator(locale)

  while (Date.now() - started < maxMs) {
    const tab = await browser.tabs.get(tabId)
    const isReady = 'complete' === tab.status && isMapTabUrl(tab.url)
    if (isReady) {
      return tab
    }
    await sleep(150)
  }

  const message = t('background.mapPageLoadTimeout')
  throw new Error(message)
}

export const focusTab = async (tab: Browser.tabs.Tab): Promise<void> => {
  if (tab.id) {
    await browser.tabs.update(tab.id, { active: true })
    if (tab.windowId) {
      await browser.windows.update(tab.windowId, { focused: true })
    }
  }
}

export const hasDefinedTabId = (tab: Browser.tabs.Tab): boolean => tab.id !== undefined

export const resolveMapTargetTab = async (
  clickedTab: Browser.tabs.Tab,
): Promise<Browser.tabs.Tab> => {
  let result: Browser.tabs.Tab

  if (clickedTab.id && isMapTabUrl(clickedTab.url)) {
    result = clickedTab
  } else {
    const queryOptions = {
      url: MAP_URL_PATTERN,
      ...(clickedTab.windowId !== undefined && { windowId: clickedTab.windowId }),
    }
    const tabsInWindow = await browser.tabs.query(queryOptions)
    const mapTabInWindow = tabsInWindow.find(hasDefinedTabId)
    if (mapTabInWindow) {
      await focusTab(mapTabInWindow)
      result = mapTabInWindow
    } else {
      const tabsAnywhere = await browser.tabs.query({ url: MAP_URL_PATTERN })
      const mapTabAnywhere = tabsAnywhere.find(hasDefinedTabId)
      if (mapTabAnywhere) {
        await focusTab(mapTabAnywhere)
        result = mapTabAnywhere
      } else {
        const created = await browser.tabs.create({ url: MAP_HOME, active: true })
        if (!created.id) {
          const locale = await syncLocaleFromStorage()
          const t = createTranslator(locale)
          const openMapFailedMessage = t('background.openMapFailed')
          throw new Error(openMapFailedMessage)
        }
        result = await waitForTabReady(created.id)
      }
    }
  }

  return result
}

export const toggleInjectedSidebar = async (tabId: number, tabUrl?: string): Promise<void> => {
  let url = tabUrl
  if (!isMapTabUrl(url)) {
    const tab = await browser.tabs.get(tabId)
    url = tab.url
  }

  const locale = await syncLocaleFromStorage()
  const t = createTranslator(locale)

  if (isMapTabUrl(url)) {
    const toggled = await retrySendTogglePanel(tabId)
    if (!toggled) {
      await browser.scripting.executeScript({
        target: { tabId },
        files: [PANEL_SIDEBAR_SCRIPT],
      })

      const retried = await retrySendTogglePanel(tabId)
      if (!retried) {
        const openPanelFailedMessage = t('background.openPanelFailed')
        throw new Error(openPanelFailedMessage)
      }
    }
  } else {
    const openMapAndRetryMessage = t('background.openMapAndRetry')
    throw new Error(openMapAndRetryMessage)
  }
}

export const openInjectedPanel = async (tab: Browser.tabs.Tab): Promise<void> => {
  const locale = await syncLocaleFromStorage()
  const t = createTranslator(locale)
  const targetTab = await resolveMapTargetTab(tab)
  if (!targetTab.id) {
    const message = t('background.tabNotFound')
    throw new Error(message)
  }

  const isReady = isMapTabUrl(targetTab.url) && 'complete' === targetTab.status
  if (!isReady) {
    await waitForTabReady(targetTab.id)
  }

  const readyTab = await browser.tabs.get(targetTab.id)
  if (!readyTab.id) {
    const message = t('background.tabNotFound')
    throw new Error(message)
  }
  await toggleInjectedSidebar(readyTab.id, readyTab.url)
}

export const resolveClickedTab = async (
  tab?: { id?: number; [key: string]: unknown } | Browser.tabs.Tab,
): Promise<Browser.tabs.Tab | undefined> => {
  let result: Browser.tabs.Tab | undefined
  if (tab?.id) {
    result = tab as Browser.tabs.Tab
  } else {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
    result = activeTab
  }
  return result
}

export const tryOpenNativeSidePanel = async (clickedTab: Browser.tabs.Tab): Promise<boolean> => {
  const useNative = await shouldUseNativeSidePanel()
  let openedNatively = false
  if (useNative && clickedTab.windowId) {
    const sidePanel = getSidePanelApi()
    try {
      if (sidePanel) {
        await sidePanel.setOptions({ path: PANEL_PAGE, enabled: true })
        await sidePanel.open({ windowId: clickedTab.windowId })
        openedNatively = true
      }
    } catch (error: unknown) {
      console.warn('[nmap_uploader] native sidePanel.open failed:', error)
    }
  }
  return openedNatively
}

export const openPanel = async (tab: Browser.tabs.Tab): Promise<void> => {
  const clickedTab = await resolveClickedTab(tab)
  if (!clickedTab?.id) return

  const isYandex = await resolveIsYandexBrowser()
  if (isYandex) {
    await openInjectedPanel(clickedTab)
    return
  }

  const openedNatively = await tryOpenNativeSidePanel(clickedTab)
  if (!openedNatively) {
    await openInjectedPanel(clickedTab)
  }
}

export const configureInstalledSidePanel = async (): Promise<void> => {
  const useNative = await shouldUseNativeSidePanel()
  if (useNative) {
    const sidePanel = getSidePanelApi()
    try {
      await sidePanel?.setOptions({ path: PANEL_PAGE, enabled: true })
    } catch (error: unknown) {
      console.warn('[nmap_uploader] sidePanel.setOptions failed:', error)
    }
  }
}
