/**
 * Регистрация и управление инжектируемым сайдбаром панели.
 */
import { browser } from 'wxt/browser'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { isMapTabUrl } from '@/lib/map_tab'
import { sleep } from './tab_navigation'

export const PANEL_SIDEBAR_SCRIPT = '/content-scripts/panel-sidebar.js' as const
export const PANEL_SIDEBAR_REGISTRATION_ID = 'nmap-panel-sidebar' as const

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
