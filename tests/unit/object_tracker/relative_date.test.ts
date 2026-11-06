// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { formatAbsoluteDate, formatRelativeDate } from '@/lib/object_tracker/ui/relative_date'

const at = (iso: string): number => Date.parse(iso)

describe('object_tracker: относительная дата', () => {
  const base = at('2026-11-05T12:00:00+03:00')

  it('только что для свежего события', () => {
    expect(formatRelativeDate('2026-11-05T11:59:40+03:00', base)).toBe('только что')
  })

  it('минуты с правильным склонением', () => {
    expect(formatRelativeDate('2026-11-05T11:59:00+03:00', base)).toBe('минуту назад')
    expect(formatRelativeDate('2026-11-05T11:58:00+03:00', base)).toBe('2 минуты назад')
    expect(formatRelativeDate('2026-11-05T11:55:00+03:00', base)).toBe('5 минут назад')
    expect(formatRelativeDate('2026-11-05T11:38:00+03:00', base)).toBe('22 минуты назад')
  })

  it('часы с правильным склонением', () => {
    expect(formatRelativeDate('2026-11-05T11:00:00+03:00', base)).toBe('час назад')
    expect(formatRelativeDate('2026-11-05T10:00:00+03:00', base)).toBe('2 часа назад')
    expect(formatRelativeDate('2026-11-05T07:00:00+03:00', base)).toBe('5 часов назад')
  })

  it('вчера для предыдущего календарного дня', () => {
    expect(formatRelativeDate('2026-11-04T20:00:00+03:00', base)).toBe('вчера')
  })

  it('дни до недели', () => {
    expect(formatRelativeDate('2026-11-03T12:00:00+03:00', base)).toBe('2 дня назад')
    expect(formatRelativeDate('2026-11-01T12:00:00+03:00', base)).toBe('4 дня назад')
  })

  it('абсолютная дата для старых событий', () => {
    expect(formatRelativeDate('2022-01-12T19:45:13+03:00', base)).toBe('12 января 2022')
  })

  it('возвращает исходную строку на невалидной дате', () => {
    expect(formatRelativeDate('не дата', base)).toBe('не дата')
  })

  it('не показывает отрицательное время', () => {
    expect(formatRelativeDate('2026-11-05T13:00:00+03:00', base)).toBe('только что')
  })
})

describe('object_tracker: абсолютная дата', () => {
  it('форматирует как в нативной ленте', () => {
    expect(formatAbsoluteDate(new Date('2022-01-12T19:45:13+03:00'))).toBe('12 января 2022')
    expect(formatAbsoluteDate(new Date('2026-11-05T11:22:11+03:00'))).toBe('5 ноября 2026')
  })
})
