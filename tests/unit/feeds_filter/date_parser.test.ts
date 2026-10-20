import { describe, expect, it } from 'vitest'
import { parseEventDateString } from '@/lib/feeds_filter/date_parser'

describe('parseEventDateString (TDD slice: parsing feed event timestamps)', () => {
  const referenceTimestamp = new Date('2026-10-20T12:00:00.000Z').getTime()

  it('разбирает строку "только что"', () => {
    const parsed = parseEventDateString('только что', referenceTimestamp)
    expect(parsed?.getTime()).toBe(referenceTimestamp)
  })

  it('разбирает относительное время "10 минут назад"', () => {
    const parsed = parseEventDateString('10 минут назад', referenceTimestamp)
    expect(parsed?.getTime()).toBe(referenceTimestamp - 10 * 60 * 1000)
  })

  it('разбирает относительное время "2 часа назад"', () => {
    const parsed = parseEventDateString('2 часа назад', referenceTimestamp)
    expect(parsed?.getTime()).toBe(referenceTimestamp - 2 * 3600 * 1000)
  })

  it('разбирает дату в формате ISO YYYY-MM-DD', () => {
    const parsed = parseEventDateString('2026-05-15 10:30')
    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(4) // 0-indexed May
    expect(parsed?.getDate()).toBe(15)
  })

  it('возвращает null для пустых или некорректных строк', () => {
    expect(parseEventDateString('')).toBeNull()
    expect(parseEventDateString('   ')).toBeNull()
    expect(parseEventDateString('непонятная строка без даты')).toBeNull()
  })
})
