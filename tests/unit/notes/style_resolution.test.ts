import { describe, expect, it } from 'vitest'
import {
  createDefaultStyle,
  isSupportedColor,
  resolveNoteStyle,
  withOpacity,
} from '@/lib/notes/model/style_resolution'

describe('createDefaultStyle', () => {
  it('даёт заливку только площадным видам', () => {
    expect(createDefaultStyle('Point').fillColor).toBeNull()
    expect(createDefaultStyle('Line').fillColor).toBeNull()
    expect(createDefaultStyle('Polygon').fillColor).not.toBeNull()
    expect(createDefaultStyle('Circle').opacity).toBeLessThan(1)
  })
})

describe('resolveNoteStyle', () => {
  const style = createDefaultStyle('Polygon')

  it('наследует цвет группы, если у заметки свой не задан', () => {
    expect(resolveNoteStyle({ style }, { color: '#5aa845' }).color).toBe('#5aa845')
  })

  it('свой цвет заметки перекрывает цвет группы', () => {
    const own = { ...style, color: '#e96b7c' }
    expect(resolveNoteStyle({ style: own }, { color: '#5aa845' }).color).toBe('#e96b7c')
  })

  it('без группы и своего цвета берёт цвет палитры', () => {
    expect(resolveNoteStyle({ style }).color).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('withOpacity', () => {
  it('возвращает исходный цвет при полной непрозрачности', () => {
    expect(withOpacity('#1a8cff', 1)).toBe('#1a8cff')
  })

  it('добавляет альфу в rgba', () => {
    expect(withOpacity('#1a8cff', 0.5)).toBe('rgba(26, 140, 255, 0.5)')
  })

  it('ограничивает альфу диапазоном 0..1', () => {
    expect(withOpacity('#000000', 2)).toBe('#000000')
    expect(withOpacity('#000000', -1)).toBe('rgba(0, 0, 0, 0)')
  })
})

describe('isSupportedColor', () => {
  it('принимает только hex', () => {
    expect(isSupportedColor('#fff')).toBe(true)
    expect(isSupportedColor('#FF8800')).toBe(true)
    expect(isSupportedColor('red')).toBe(false)
    expect(isSupportedColor(null)).toBe(false)
  })
})
