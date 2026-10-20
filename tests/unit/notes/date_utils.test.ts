import { describe, expect, it } from 'vitest'
import { extractTrackerDate } from '@/lib/notes/date_utils'

describe('extractTrackerDate', () => {
  it('извлекает дату в формате DD-MM-YYYY из строки трекера Яндекса "дата 17.06.2026 г."', () => {
    expect(extractTrackerDate('дата 17.06.2026 г.')).toBe('17-06-2026')
  })

  it('извлекает дату из строки только с датой "01.05.2025"', () => {
    expect(extractTrackerDate('01.05.2025')).toBe('01-05-2025')
  })

  it('возвращает undefined для пустых или некорректных строк', () => {
    expect(extractTrackerDate('')).toBeUndefined()
    expect(extractTrackerDate('без даты')).toBeUndefined()
    expect(extractTrackerDate('2025-05-01')).toBeUndefined()
    expect(extractTrackerDate(null)).toBeUndefined()
    expect(extractTrackerDate(undefined)).toBeUndefined()
  })
})
