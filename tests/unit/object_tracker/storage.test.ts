import { beforeEach, describe, expect, it } from 'vitest'
import {
  clampIntervalMinutes,
  forgetObjectLocalState,
  getTrackerLocalState,
  getTrackerSettings,
  isValidObjectId,
  normalizeObjectId,
  sanitizeTrackedObjects,
  setCachedCommits,
  setReadMarks,
  setTrackedObjects,
  setTrackerEnabled,
  setTrackerInterval,
} from '@/lib/object_tracker/storage'
import { DEFAULT_INTERVAL_MINUTES, MAX_TRACKED_OBJECTS } from '@/lib/object_tracker/types'
import { resetBrowserMocks } from '../../setup/browser_mock'

describe('object_tracker: валидация', () => {
  it('принимает только числовые id', () => {
    expect(isValidObjectId('4465652155')).toBe(true)
    expect(isValidObjectId('abc')).toBe(false)
    expect(isValidObjectId('')).toBe(false)
    expect(isValidObjectId('-1')).toBe(false)
  })

  it('нормализует пробелы по краям', () => {
    expect(normalizeObjectId('  123  ')).toBe('123')
  })

  it('ограничивает период опроса', () => {
    expect(clampIntervalMinutes(1)).toBe(5)
    expect(clampIntervalMinutes(10_000)).toBe(240)
    expect(clampIntervalMinutes(Number.NaN)).toBe(DEFAULT_INTERVAL_MINUTES)
    expect(clampIntervalMinutes(30)).toBe(30)
  })

  it('убирает дубли, мусор и превышение лимита', () => {
    const many = Array.from({ length: MAX_TRACKED_OBJECTS + 5 }, (_, index) => ({
      id: String(index + 1),
      title: '',
      addedAt: 0,
    }))

    const sanitized = sanitizeTrackedObjects([
      { id: '1', title: 'a', addedAt: 1 },
      { id: '1', title: 'b', addedAt: 2 },
      { id: 'abc', title: 'c', addedAt: 3 },
      ...many,
    ])

    expect(sanitized).toHaveLength(MAX_TRACKED_OBJECTS)
    expect(sanitized[0]).toEqual({ id: '1', title: 'a', addedAt: 1 })
  })
})

describe('object_tracker: storage', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('по умолчанию выключен и опрашивает раз в 30 минут', async () => {
    const settings = await getTrackerSettings()

    expect(settings.enabled).toBe(false)
    expect(settings.intervalMinutes).toBe(DEFAULT_INTERVAL_MINUTES)
    expect(settings.objects).toEqual([])
  })

  it('сохраняет и читает включённость', async () => {
    await setTrackerEnabled(true)

    await expect(getTrackerSettings()).resolves.toMatchObject({ enabled: true })
  })

  it('сохраняет и читает интервал с ограничением', async () => {
    await setTrackerInterval(1)

    await expect(getTrackerSettings()).resolves.toMatchObject({ intervalMinutes: 5 })
  })

  it('сохраняет список объектов без дублей', async () => {
    await setTrackedObjects([
      { id: '1', title: 'Первый', addedAt: 1 },
      { id: '1', title: 'Дубль', addedAt: 2 },
    ])

    const settings = await getTrackerSettings()
    expect(settings.objects).toHaveLength(1)
    expect(settings.objects[0]?.title).toBe('Первый')
  })

  it('сохраняет категорию объекта для нативной иконки', async () => {
    await setTrackedObjects([{ id: '1', title: 'Хутор', categoryId: 'ad_jc', addedAt: 1 }])

    const settings = await getTrackerSettings()
    expect(settings.objects[0]?.categoryId).toBe('ad_jc')
  })

  it('хранит отметки и кэш отдельно от синхронизируемых настроек', async () => {
    await setReadMarks({ '1': '100' })
    await setCachedCommits({ '1': [] })

    const state = await getTrackerLocalState()
    expect(state.readMarks).toEqual({ '1': '100' })
    expect(state.cachedCommits).toEqual({ '1': [] })

    const settings = await getTrackerSettings()
    expect(settings).not.toHaveProperty('readMarks')
  })

  it('удаляет локальные данные объекта', async () => {
    await setReadMarks({ '1': '100', '2': '200' })
    await setCachedCommits({ '1': [], '2': [] })

    await forgetObjectLocalState('1')

    const state = await getTrackerLocalState()
    expect(state.readMarks).toEqual({ '2': '200' })
    expect(state.cachedCommits).toEqual({ '2': [] })
  })

  it('переживает мусор в хранилище', async () => {
    await setReadMarks({} as Record<string, string>)

    await expect(getTrackerLocalState()).resolves.toEqual({
      readMarks: {},
      cachedCommits: {},
    })
  })
})
