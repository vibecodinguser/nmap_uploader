import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import {
  applyGoToVisibleOrder,
  GO_TO_ITEMS_STORAGE_KEY,
  GO_TO_MENU_ENABLED_STORAGE_KEY,
  getActiveGoToItems,
  getDefaultGoToItems,
  getStoredGoToItems,
  getStoredGoToMenuEnabled,
  moveGoToItemBy,
  moveGoToItemTo,
  normalizeGoToItems,
  setStoredGoToItems,
  setStoredGoToMenuEnabled,
} from '@/lib/go_to_settings'
import {
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  getStoredSplitButtonEnabled,
  setStoredSplitButtonEnabled,
} from '@/lib/go_to_split_button'
import { resetBrowserMocks } from '../setup/browser_mock'

describe('normalizeGoToItems', () => {
  it('возвращает значения по умолчанию для пустого хранилища', () => {
    const items = normalizeGoToItems(undefined)
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.active)).toBe(true)
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
  it('активирует все источники', () => {
    const items = getDefaultGoToItems()
    expect(items.every((item) => item.active)).toBe(true)
  })

  it('сохраняет порядок источников по умолчанию', () => {
    const items = getDefaultGoToItems().map((item) => item.name)
    expect(items).toEqual([
      'Rosreestr',
      '2GIS',
      'Google',
      'OpenStreetMap',
      'Nakarte',
      'Wikimapia',
      'Retromap',
      'GoogleEarth',
      'Bing',
      'Mapillary',
      'Copernicus',
      'Here',
      'Etomesto',
      'Strava',
    ])
  })
})

describe('moveGoToItemTo', () => {
  const items = [
    { name: 'A', active: true },
    { name: 'B', active: true },
    { name: 'C', active: true },
  ]

  it('ставит пункт на место цели при движении вниз', () => {
    expect(moveGoToItemTo(items, 'A', 'C').map((item) => item.name)).toEqual(['B', 'C', 'A'])
  })

  it('ставит пункт на место цели при движении вверх', () => {
    expect(moveGoToItemTo(items, 'C', 'A').map((item) => item.name)).toEqual(['C', 'A', 'B'])
  })

  it('возвращает исходный массив, когда переставлять нечего', () => {
    expect(moveGoToItemTo(items, 'B', 'B')).toBe(items)
    expect(moveGoToItemTo(items, 'A', 'нет такого')).toBe(items)
    expect(moveGoToItemTo(items, 'нет такого', 'A')).toBe(items)
  })
})

describe('moveGoToItemBy', () => {
  const items = [
    { name: 'A', active: true },
    { name: 'B', active: false },
    { name: 'C', active: true },
  ]

  it('сдвигает пункт вверх и вниз', () => {
    expect(moveGoToItemBy(items, 'C', -1).map((item) => item.name)).toEqual(['A', 'C', 'B'])
    expect(moveGoToItemBy(items, 'A', 1).map((item) => item.name)).toEqual(['B', 'A', 'C'])
  })

  it('сдвигает и через выключенные пункты: в настройках видны все строки', () => {
    expect(moveGoToItemBy(items, 'A', 2).map((item) => item.name)).toEqual(['B', 'C', 'A'])
  })

  it('возвращает исходный массив на границе и для неизвестного пункта', () => {
    expect(moveGoToItemBy(items, 'A', -1)).toBe(items)
    expect(moveGoToItemBy(items, 'C', 1)).toBe(items)
    expect(moveGoToItemBy(items, 'нет такого', 1)).toBe(items)
  })
})

describe('applyGoToVisibleOrder', () => {
  const items = [
    { name: 'A', active: true },
    { name: 'B', active: false },
    { name: 'C', active: true },
    { name: 'D', active: false },
    { name: 'E', active: true },
  ]

  it('переставляет только активные, неактивные остаются на местах', () => {
    const next = applyGoToVisibleOrder(items, ['E', 'A', 'C'])
    expect(next.map((item) => item.name)).toEqual(['E', 'B', 'A', 'D', 'C'])
    expect(next.map((item) => item.active)).toEqual([true, false, true, false, true])
  })

  it('возвращает исходный массив, если порядок не изменился', () => {
    expect(applyGoToVisibleOrder(items, ['A', 'C', 'E'])).toBe(items)
  })

  it('не трогает список, если видимые имена не совпадают с активными', () => {
    expect(applyGoToVisibleOrder(items, ['A', 'C'])).toBe(items)
    expect(applyGoToVisibleOrder(items, ['A', 'A', 'C'])).toBe(items)
    expect(applyGoToVisibleOrder(items, ['A', 'C', 'нет такого'])).toBe(items)
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

  it('выключает раздельный вид по умолчанию', async () => {
    expect(await getStoredSplitButtonEnabled()).toBe(false)
  })

  it('сохраняет и восстанавливает флаг раздельного вида', async () => {
    await setStoredSplitButtonEnabled(true)
    expect(await getStoredSplitButtonEnabled()).toBe(true)

    const stored = await browser.storage.local.get(GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY)
    expect(stored[GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]).toBe(true)

    await setStoredSplitButtonEnabled(false)
    expect(await getStoredSplitButtonEnabled()).toBe(false)
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
    expect(
      (await browser.storage.local.get(GO_TO_ITEMS_STORAGE_KEY))[GO_TO_ITEMS_STORAGE_KEY],
    ).toEqual(saved)
  })
})
