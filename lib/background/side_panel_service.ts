/**
 * Управление открытием панели расширения (Native SidePanel API или инжектируемый сайдбар).
 */
import { type Browser, browser } from 'wxt/browser'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { isMapTabUrl } from '@/lib/map_tab'
import { toggleInjectedSidebar } from './sidebar_injector'
import { resolveClickedTab, resolveMapTargetTab, waitForTabReady } from './tab_navigation'
import { resolveIsYandexBrowser } from './yandex_detector'

export const PANEL_PAGE = '/panel.html'

export * from './sidebar_injector'
export * from './tab_navigation'
export * from './yandex_detector'

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

export const shouldUseNativeSidePanel = async (): Promise<boolean> => {
  const isYandex = await resolveIsYandexBrowser()
  const sidePanelApi = getSidePanelApi()
  let useNative = false
  if (!isYandex && sidePanelApi) {
    useNative = true
  }
  return useNative
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
