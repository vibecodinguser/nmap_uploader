import { browser } from 'wxt/browser'
import {
  convertLegacyGoToItems,
  GO_TO_ITEMS_STORAGE_KEY,
  GO_TO_MENU_ENABLED_STORAGE_KEY,
  type GoToItem,
  getActiveGoToItems,
  getDefaultGoToItems,
  normalizeGoToItems,
} from '@/lib/go_to'

export type { GoToItem }
export {
  convertLegacyGoToItems,
  GO_TO_ITEMS_STORAGE_KEY,
  GO_TO_MENU_ENABLED_STORAGE_KEY,
  getActiveGoToItems,
  getDefaultGoToItems,
  normalizeGoToItems,
}

export const getStoredGoToMenuEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(GO_TO_MENU_ENABLED_STORAGE_KEY)
  const value = stored[GO_TO_MENU_ENABLED_STORAGE_KEY]
  return value === undefined ? true : Boolean(value)
}

export const setStoredGoToMenuEnabled = async (enabled: boolean): Promise<void> => {
  await browser.storage.local.set({ [GO_TO_MENU_ENABLED_STORAGE_KEY]: enabled })
}

export const getStoredGoToItems = async (): Promise<GoToItem[]> => {
  const stored = await browser.storage.local.get(GO_TO_ITEMS_STORAGE_KEY)
  return normalizeGoToItems(stored[GO_TO_ITEMS_STORAGE_KEY])
}

export const setStoredGoToItems = async (items: GoToItem[]): Promise<GoToItem[]> => {
  const normalized = normalizeGoToItems(items)
  await browser.storage.local.set({ [GO_TO_ITEMS_STORAGE_KEY]: normalized })
  return normalized
}
