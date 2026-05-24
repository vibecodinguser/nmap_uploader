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

  try {
    await browser.tabs.sendMessage(tabId, { action: 'togglePanel' })
    return
  } catch {
    // content script ещё не загружен на вкладке
  }

  await browser.scripting.executeScript({
    target: { tabId },
    files: ['/content-scripts/panel-sidebar.js'],
  })
  await browser.tabs.sendMessage(tabId, { action: 'togglePanel' })
}

const openPanel = async (tab: Browser.tabs.Tab) => {
  if (!tab.id) return

  const sidePanel = getSidePanelApi()
  if (sidePanel && tab.windowId) {
    try {
      await sidePanel.setOptions({ path: PANEL_PAGE, enabled: true })
      await sidePanel.open({ windowId: tab.windowId })
      return
    } catch (error: unknown) {
      console.warn('[nmap_uploader] native sidePanel.open failed:', error)
    }
  }

  await toggleInjectedSidebar(tab.id, tab.url)
}

export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    openPanel(tab).catch((error: unknown) => {
      console.error('[nmap_uploader] openPanel failed:', error)
    })
  })

  browser.runtime.onInstalled.addListener(() => {
    const sidePanel = getSidePanelApi()
    if (!sidePanel?.setOptions) return

    sidePanel.setOptions({ path: PANEL_PAGE, enabled: true }).catch((error: unknown) => {
      console.warn('[nmap_uploader] sidePanel.setOptions failed:', error)
    })
  })

  browser.runtime.onMessage.addListener((message) => {
    if (message?.action !== 'submit') return

    console.info('[nmap_uploader] submit:', message.payload)
    return Promise.resolve({ ok: true })
  })
})
