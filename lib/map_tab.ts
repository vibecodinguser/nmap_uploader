import { browser } from 'wxt/browser'

export const MAP_ORIGIN = 'https://n.maps.yandex.ru'
export const MAP_TAB_URL_PATTERN = `${MAP_ORIGIN}/*`

export const isMapTabUrl = (url?: string): boolean => {
  if (!url) return false
  return url === MAP_ORIGIN || url.startsWith(`${MAP_ORIGIN}/`)
}

export const collectMapTabIds = async (preferredTabId?: number): Promise<number[]> => {
  const ids = new Set<number>()

  if (preferredTabId !== undefined) {
    try {
      const preferredTab = await browser.tabs.get(preferredTabId)
      if (isMapTabUrl(preferredTab.url)) {
        ids.add(preferredTabId)
      }
    } catch {
      // вкладка могла закрыться
    }
  }

  const activeMapTabId = await getActiveMapTabId()
  if (activeMapTabId !== undefined) {
    ids.add(activeMapTabId)
  }

  const tabsByPattern = await browser.tabs.query({ url: MAP_TAB_URL_PATTERN })
  for (const tab of tabsByPattern) {
    if (tab.id !== undefined) ids.add(tab.id)
  }

  const allTabs = await browser.tabs.query({})
  for (const tab of allTabs) {
    if (tab.id !== undefined && isMapTabUrl(tab.url)) {
      ids.add(tab.id)
    }
  }

  return [...ids]
}

export const getActiveMapTabId = async (): Promise<number | undefined> => {
  const queries = [
    browser.tabs.query({ active: true, lastFocusedWindow: true }),
    browser.tabs.query({ active: true, currentWindow: true }),
  ]

  for (const query of queries) {
    try {
      const [tab] = await query
      if (tab?.id !== undefined && isMapTabUrl(tab.url)) {
        return tab.id
      }
    } catch {
      // query может быть недоступен в части контекстов
    }
  }

  return undefined
}
