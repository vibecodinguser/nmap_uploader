import { browser } from 'wxt/browser'

export const GO_TO_REFRESH_ACTION = 'refreshGoToMenu'

/** Просит background переслать обновление go-to menu во вкладки карты. */
export const notifyMapTabsAboutGoToMenu = async (): Promise<void> => {
  try {
    await browser.runtime.sendMessage({ action: GO_TO_REFRESH_ACTION })
  } catch (error: unknown) {
    console.warn('[nmap_uploader] refreshGoToMenu notify failed:', error)
  }
}
