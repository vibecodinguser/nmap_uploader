import { describe, expect, it } from 'vitest'
import {
  buildRecolorStyleSheet,
  colorToKey,
  isMagentaColor,
  parseRgb,
} from '@/lib/stroke_color/recolor_core'

describe('stroke_color/recolor_core', () => {
  describe('parseRgb', () => {
    it('парсит стандартные имена magenta', () => {
      expect(parseRgb('magenta')).toEqual({ r: 255, g: 0, b: 255 })
      expect(parseRgb('#f0f')).toEqual({ r: 255, g: 0, b: 255 })
      expect(parseRgb('#FF00FF')).toEqual({ r: 255, g: 0, b: 255 })
    })

    it('парсит короткие hex цвета', () => {
      expect(parseRgb('#123')).toEqual({ r: 17, g: 34, b: 51 })
    })

    it('парсит полные hex цвета с альфа-каналом и без', () => {
      expect(parseRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
      expect(parseRgb('#00ff00ff')).toEqual({ r: 0, g: 255, b: 0 })
    })

    it('парсит rgb() и rgba() нотации', () => {
      expect(parseRgb('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30 })
      expect(parseRgb('rgba(255, 0, 128, 0.5)')).toEqual({ r: 255, g: 0, b: 128 })
    })

    it('возвращает null для некорректных форматов', () => {
      expect(parseRgb('invalid-color')).toBeNull()
      expect(parseRgb('')).toBeNull()
    })
  })

  describe('isMagentaColor', () => {
    it('распознает различные представления чистого magenta', () => {
      expect(isMagentaColor('magenta')).toBe(true)
      expect(isMagentaColor('#f0f')).toBe(true)
      expect(isMagentaColor('#ff00ff')).toBe(true)
      expect(isMagentaColor('rgb(255, 0, 255)')).toBe(true)
    })

    it('отклоняет другие цвета', () => {
      expect(isMagentaColor('#ff00fe')).toBe(false)
      expect(isMagentaColor('red')).toBe(false)
      expect(isMagentaColor(null)).toBe(false)
      expect(isMagentaColor(undefined)).toBe(false)
    })
  })

  describe('colorToKey', () => {
    it('создает нормализованный ключ "r,g,b"', () => {
      expect(colorToKey('#f0f')).toBe('255,0,255')
      expect(colorToKey('rgb(10, 20, 30)')).toBe('10,20,30')
      expect(colorToKey('invalid')).toBeNull()
    })
  })

  describe('buildRecolorStyleSheet', () => {
    it('генерирует CSS с подстановкой targetStroke', () => {
      const css = buildRecolorStyleSheet('#00ff00')
      expect(css).toContain('stroke: #00ff00 !important;')
      expect(css).toContain('ymaps svg [stroke="#ff00ff" i]')
    })
  })
})
