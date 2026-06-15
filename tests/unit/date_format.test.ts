import { describe, expect, it } from 'vitest'
import {
  displayToIso,
  formatDateDisplay,
  formatDateDisplayInput,
  formatDateIso,
  isValidDisplayDate,
  normalizeDisplayTargetDate,
  parseDateDisplay,
  parseDateIso,
} from '@/lib/date_format'

describe('date_format', () => {
  it('formatDateIso: форматирует дату в YYYY-MM-DD', () => {
    expect(formatDateIso(new Date(2026, 4, 24))).toBe('2026-05-24')
  })

  it('parseDateIso: разбирает валидную дату', () => {
    const parsed = parseDateIso('2026-05-24')
    expect(parsed).toBeInstanceOf(Date)
    expect(formatDateIso(parsed as Date)).toBe('2026-05-24')
  })

  it('parseDateIso: возвращает undefined для невалидной даты', () => {
    expect(parseDateIso('2026-13-40')).toBeUndefined()
    expect(parseDateIso('24.05.2026')).toBeUndefined()
  })

  it('formatDateDisplay: форматирует дату в DD-MM-YYYY', () => {
    expect(formatDateDisplay(new Date(2026, 4, 24))).toBe('24-05-2026')
  })

  it('formatDateDisplayInput: применяет маску при вводе', () => {
    expect(formatDateDisplayInput('24052026')).toBe('24-05-2026')
    expect(formatDateDisplayInput('24-05-2026')).toBe('24-05-2026')
    expect(formatDateDisplayInput('24')).toBe('24')
  })

  it('parseDateDisplay: разбирает DD-MM-YYYY', () => {
    expect(parseDateDisplay('24-05-2026')).toBeInstanceOf(Date)
    expect(isValidDisplayDate('24-05-2026')).toBe(true)
    expect(parseDateDisplay('32-01-2026')).toBeUndefined()
  })

  it('displayToIso: конвертирует DD-MM-YYYY в ISO', () => {
    expect(displayToIso('24-05-2026')).toBe('2026-05-24')
    expect(displayToIso('24-05')).toBeUndefined()
  })

  it('normalizeDisplayTargetDate: нормализует дату для загрузки', () => {
    expect(normalizeDisplayTargetDate('24-05-2026')).toBe('2026-05-24')
    expect(normalizeDisplayTargetDate('')).toBeUndefined()
    expect(() => normalizeDisplayTargetDate('32-01-2026')).toThrow('Неверный формат даты')
  })
})
