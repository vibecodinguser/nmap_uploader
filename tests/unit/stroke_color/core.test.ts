import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STROKE_COLOR,
  getEffectiveStrokeColor,
  normalizeStrokeColor,
  toStrokeColorInputValue,
} from '@/lib/stroke_color/core'

describe('StrokeColor Core (TDD slice: pure hex color normalization)', () => {
  it('нормализует короткий hex без решетки (f0f -> #ff00ff)', () => {
    expect(normalizeStrokeColor('f0f')).toBe('#ff00ff')
  })

  it('нормализует полный hex с решеткой и в верхнем регистре', () => {
    expect(normalizeStrokeColor('#00FF00')).toBe('#00ff00')
    expect(normalizeStrokeColor('123456')).toBe('#123456')
  })

  it('возвращает null для некорректных значений', () => {
    expect(normalizeStrokeColor('')).toBeNull()
    expect(normalizeStrokeColor('not-a-color')).toBeNull()
    expect(normalizeStrokeColor('#12345')).toBeNull()
    expect(normalizeStrokeColor('#1234567')).toBeNull()
  })

  it('возвращает эффективный цвет по умолчанию при невалидном вводе', () => {
    expect(getEffectiveStrokeColor('')).toBe(DEFAULT_STROKE_COLOR)
    expect(getEffectiveStrokeColor(null)).toBe(DEFAULT_STROKE_COLOR)
    expect(getEffectiveStrokeColor('invalid')).toBe(DEFAULT_STROKE_COLOR)
  })

  it('преобразует цвет в значение для поля ввода без префикса #', () => {
    expect(toStrokeColorInputValue('#ff00ff')).toBe('ff00ff')
    expect(toStrokeColorInputValue('123456')).toBe('123456')
    expect(toStrokeColorInputValue('')).toBe('')
  })
})
