import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import {
  GO_TO_ITEMS_STORAGE_KEY,
  GO_TO_MENU_ENABLED_STORAGE_KEY,
  getActiveGoToItems,
  getDefaultGoToItems,
  getStoredGoToItems,
  getStoredGoToMenuEnabled,
  normalizeGoToItems,
  setStoredGoToItems,
  setStoredGoToMenuEnabled,
} from '@/lib/go_to_settings'
import { resetBrowserMocks } from '../setup/browser_mock'

describe('normalizeGoToItems', () => {
  it('возвращает значения по умолчанию для пустого хранилища', () => {
    const items = normalizeGoToItems(undefined)
    expect(items.length).toBeGreaterThan(5)
    expect(items.filter((item) => item.active)).toHaveLength(5)
  })

  it('сохраняет порядок и добавляет отсутствующие источники', () => {
    const items = normalizeGoToItems([
      { name: 'Google', active: true },
      { name: 'Bing', active: false },
    ])

    expect(items[0]).toEqual({ name: 'Google', active: true })
    expect(items[1]).toEqual({ name: 'Bing', active: false })
    expect(items.some((item) => item.name === 'Rosreestr')).toBe(true)
  })

  it('конвертирует устаревший формат со строками', () => {
    const items = normalizeGoToItems(['Google', 'Bing'])
    expect(getActiveGoToItems(items).map((item) => item.name)).toEqual(['Google', 'Bing'])
  })
})

describe('getDefaultGoToItems', () => {
  it('активирует первые пять источников', () => {
    const items = getDefaultGoToItems()
    expect(items.filter((item) => item.active)).toHaveLength(5)
  })

  it('сохраняет порядок источников по умолчанию', () => {
    const items = getDefaultGoToItems().map((item) => item.name)
    expect(items).toEqual([
      'OpenStreetMap',
      'Nakarte',
      'Wikimapia',
      'Retromap',
      'Rosreestr',
      '2GIS',
      'Google',
      'Bing',
      'Mapillary',
      'Copernicus',
      'Here',
    ])
  })
})

describe('go_to storage', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('включает меню по умолчанию', async () => {
    expect(await getStoredGoToMenuEnabled()).toBe(true)
  })

  it('сохраняет и восстанавливает флаг меню', async () => {
    await setStoredGoToMenuEnabled(false)

    expect(await getStoredGoToMenuEnabled()).toBe(false)

    const stored = await browser.storage.local.get(GO_TO_MENU_ENABLED_STORAGE_KEY)
    expect(stored[GO_TO_MENU_ENABLED_STORAGE_KEY]).toBe(false)
  })

  it('нормализует список при сохранении и чтении', async () => {
    const saved = await setStoredGoToItems([
      { name: 'Google', active: true },
      { name: 'Bing', active: false },
    ])

    expect(saved[0]).toEqual({ name: 'Google', active: true })
    expect(saved.some((item) => item.name === 'Rosreestr')).toBe(true)

    const loaded = await getStoredGoToItems()
    expect(loaded).toEqual(saved)
    expect((await browser.storage.local.get(GO_TO_ITEMS_STORAGE_KEY))[GO_TO_ITEMS_STORAGE_KEY]).toEqual(
      saved,
    )
  })
})
