import { browser } from 'wxt/browser'
import { collectMapTabIds, isMapTabUrl } from '@/lib/map_tab'

export const RELOAD_EDITOR_PAGE_ACTION = 'reloadEditorPage'

export const reloadMapEditorTabs = async ({
  preferredTabId,
}: {
  preferredTabId?: number
} = {}): Promise<boolean> => {
  let tabIds: number[]

  if (preferredTabId !== undefined) {
    try {
      const preferredTab = await browser.tabs.get(preferredTabId)
      tabIds = isMapTabUrl(preferredTab.url) ? [preferredTabId] : await collectMapTabIds()
    } catch {
      tabIds = await collectMapTabIds()
    }
  } else {
    tabIds = await collectMapTabIds()
  }

  if (tabIds.length === 0) return false

  const results = await Promise.allSettled(tabIds.map((tabId) => browser.tabs.reload(tabId)))
  return results.some((result) => result.status === 'fulfilled')
}
