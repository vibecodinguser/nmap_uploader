import { GO_TO_SOURCE_NAMES, GO_TO_SOURCES } from '@/lib/go_to_sources'

export type GoToItem = {
  name: string
  active: boolean
}

export const GO_TO_MENU_ENABLED_STORAGE_KEY = 'go_to_menu_enabled'
export const GO_TO_ITEMS_STORAGE_KEY = 'go_to_items'

/**
 * Возвращает список источников ссылок "Перейти на..." по умолчанию (все активны).
 */
export const getDefaultGoToItems = (): GoToItem[] =>
  GO_TO_SOURCE_NAMES.map((name) => ({
    name,
    active: true,
  }))

const isGoToItem = (value: unknown): value is GoToItem => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.name === 'string' && typeof item.active === 'boolean'
}

/**
 * Приводит устаревшие форматы хранения к списку { name, active }.
 */
const convertLegacyGoToItems = (stored: unknown): GoToItem[] => {
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

/**
 * Нормализует порядок и состав ссылок относительно известных источников.
 */
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

/**
 * Фильтрует активные и поддерживаемые источники ссылок.
 */
export const getActiveGoToItems = (items: GoToItem[]): GoToItem[] =>
  items.filter((item) => item.active && GO_TO_SOURCES[item.name])

/**
 * Переставляет пункт на место `targetName`: при движении вниз он встаёт после
 * цели, при движении вверх — перед ней. Если переставлять нечего, возвращает
 * исходный массив — вызывающая сторона отличает это по ссылке.
 */
export const moveGoToItemTo = (
  items: GoToItem[],
  movedName: string,
  targetName: string,
): GoToItem[] => {
  const movedIndex = items.findIndex((item) => item.name === movedName)
  const targetIndex = items.findIndex((item) => item.name === targetName)
  if (movedIndex < 0 || targetIndex < 0 || movedIndex === targetIndex) return items

  const next = [...items]
  const [moved] = next.splice(movedIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

/**
 * Сдвигает пункт на `offset` позиций (`-1` вверх, `1` вниз). На границе списка
 * возвращает исходный массив — вызывающая сторона отличает это по ссылке.
 */
export const moveGoToItemBy = (items: GoToItem[], name: string, offset: number): GoToItem[] => {
  const index = items.findIndex((item) => item.name === name)
  const targetIndex = index + offset
  const isValid = index >= 0 && targetIndex >= 0 && targetIndex < items.length
  if (!isValid) return items

  const next = [...items]
  const [moved] = next.splice(index, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

/**
 * Применяет видимый порядок пунктов меню к полному списку: позиции активных
 * пунктов переставляются, неактивные остаются на своих местах. Так
 * перетаскивание в попапе, где неактивных не видно, не тасует список в
 * настройках.
 */
export const applyGoToVisibleOrder = (
  items: GoToItem[],
  visibleNames: readonly string[],
): GoToItem[] => {
  const activeNames = items.filter((item) => item.active).map((item) => item.name)
  const isComplete =
    activeNames.length === visibleNames.length &&
    new Set(visibleNames).size === visibleNames.length &&
    activeNames.every((name) => visibleNames.includes(name))
  if (!isComplete) return items

  const byName = new Map(items.map((item) => [item.name, item]))
  const visibleItems: GoToItem[] = []
  for (const name of visibleNames) {
    const item = byName.get(name)
    if (item) visibleItems.push(item)
  }

  const next: GoToItem[] = []
  let visibleIndex = 0
  for (const item of items) {
    if (item.active) {
      next.push(visibleItems[visibleIndex])
      visibleIndex += 1
    } else {
      next.push(item)
    }
  }

  const changed = next.some((item, index) => item !== items[index])
  return changed ? next : items
}
