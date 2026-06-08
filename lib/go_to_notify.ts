import { browser } from 'wxt/browser'

export const GO_TO_REFRESH_ACTION = 'refreshGoToMenu'

const MAP_TAB_URL = 'https://n.maps.yandex.ru/*'

const sendRefreshToMapTabs = async (): Promise<void> => {
  const tabs = await browser.tabs.query({ url: MAP_TAB_URL })
  await Promise.allSettled(
    tabs.map((tab) => {
      if (!tab.id) return Promise.resolve()
      return browser.tabs.sendMessage(tab.id, { action: GO_TO_REFRESH_ACTION })
    }),
  )
}

/** Просит вкладки карты обновить кнопку go-to. */
export const notifyMapTabsAboutGoToMenu = async (): Promise<void> => {
  try {
    await browser.runtime.sendMessage({ action: GO_TO_REFRESH_ACTION })
  } catch (error: unknown) {
    console.warn('[nmap_uploader] refreshGoToMenu background notify failed:', error)
  }

  try {
    await sendRefreshToMapTabs()
  } catch (error: unknown) {
    console.warn('[nmap_uploader] refreshGoToMenu direct notify failed:', error)
  }
}
