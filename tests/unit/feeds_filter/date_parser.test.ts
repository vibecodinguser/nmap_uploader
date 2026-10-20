import { describe, expect, it } from 'vitest'
import { calculateDayAgeFromDateText, parseEventDateString } from '@/lib/feeds_filter/date_parser'

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

  describe('calculateDayAgeFromDateText', () => {
    it('определяет 0 дней для "только что", "сегодня" и времени дня', () => {
      expect(calculateDayAgeFromDateText('только что', referenceTimestamp)).toBe(0)
      expect(calculateDayAgeFromDateText('сегодня в 14:00', referenceTimestamp)).toBe(0)
      expect(calculateDayAgeFromDateText('14:20', referenceTimestamp)).toBe(0)
    })

    it('определяет 1 день для "вчера" и 2 дня для "позавчера"', () => {
      expect(calculateDayAgeFromDateText('вчера в 18:30', referenceTimestamp)).toBe(1)
      expect(calculateDayAgeFromDateText('позавчера', referenceTimestamp)).toBe(2)
    })

    it('определяет N дней для строк "N дней назад"', () => {
      expect(calculateDayAgeFromDateText('5 дней назад', referenceTimestamp)).toBe(5)
      expect(calculateDayAgeFromDateText('3 дня назад', referenceTimestamp)).toBe(3)
    })
  })
})
