import { browser } from 'wxt/browser'
import { GO_TO_SOURCE_NAMES, GO_TO_SOURCES } from '@/lib/go_to_sources'

export type GoToItem = {
  name: string
  active: boolean
}

export const GO_TO_MENU_ENABLED_STORAGE_KEY = 'go_to_menu_enabled'
export const GO_TO_ITEMS_STORAGE_KEY = 'go_to_items'

const DEFAULT_ACTIVE_COUNT = 5

export const getDefaultGoToItems = (): GoToItem[] =>
  GO_TO_SOURCE_NAMES.map((name, index) => ({
    name,
    active: index < DEFAULT_ACTIVE_COUNT,
  }))

const isGoToItem = (value: unknown): value is GoToItem => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.name === 'string' && typeof item.active === 'boolean'
}

/** Приводит устаревшие форматы хранения к списку { name, active }. */
export const convertLegacyGoToItems = (stored: unknown): GoToItem[] => {
  if (!Array.isArray(stored) || stored.length === 0) return []

  if (typeof stored[0] === 'string') {
    const activeNames = new Set(stored as string[])
    return GO_TO_SOURCE_NAMES.map((name) => ({
      name,
      active: activeNames.has(name),
    }))
  }

  const items: GoToItem[] = []
  for (const entry of stored) {
    if (!isGoToItem(entry)) continue
    items.push({ name: entry.name, active: entry.active })
  }
  return items
}

/** Нормализует порядок и состав ссылок относительно известных источников. */
export const normalizeGoToItems = (stored: unknown): GoToItem[] => {
  const converted = convertLegacyGoToItems(stored)
  if (converted.length === 0) return getDefaultGoToItems()

  const result: GoToItem[] = []
  const seen = new Set<string>()

  for (const item of converted) {
    if (!GO_TO_SOURCES[item.name] || seen.has(item.name)) continue
    seen.add(item.name)
    result.push({ name: item.name, active: item.active })
  }

  for (const name of GO_TO_SOURCE_NAMES) {
    if (seen.has(name)) continue
    result.push({ name, active: false })
  }

  return result
}

export const getActiveGoToItems = (items: GoToItem[]): GoToItem[] =>
  items.filter((item) => item.active && GO_TO_SOURCES[item.name])

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
