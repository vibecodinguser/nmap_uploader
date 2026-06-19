import { browser } from 'wxt/browser'
import { NMAPS_ORIGIN } from '@/lib/extension_origins'

export const MAP_ORIGIN = NMAPS_ORIGIN
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

  const allTabs = await browser.tabs.query({})
  for (const tab of allTabs) {
    if (tab.id !== undefined && isMapTabUrl(tab.url)) {
      ids.add(tab.id)
    }
  }

  return [...ids]
}

export const getActiveMapTabId = async (): Promise<number | undefined> => {
  const results = await Promise.allSettled([
    browser.tabs.query({ active: true, lastFocusedWindow: true }),
    browser.tabs.query({ active: true, currentWindow: true }),
  ])

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const [tab] = result.value
    if (tab?.id !== undefined && isMapTabUrl(tab.url)) {
      return tab.id
    }
  }

  return undefined
}
