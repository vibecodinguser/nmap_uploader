import { describe, expect, it } from 'vitest'
import {
  calculateRemainingPoints,
  countPointsInPath,
  countPointsInPolyline,
  getCounterThemeStyle,
  isEditorDrawingStrokeStyle,
  MAX_POINTS_LIMIT,
} from '@/lib/point_counter/core'

describe('point_counter/core', () => {
  describe('countPointsInPath', () => {
    it('считает пары координат в строке d', () => {
      expect(countPointsInPath('M 10 20 L 30 40 L 50 60')).toBe(3)
      expect(countPointsInPath('M10,20L30,40')).toBe(2)
      expect(countPointsInPath('M 10.5 -20.2 L -30.1 40.8')).toBe(2)
      expect(countPointsInPath('')).toBe(0)
      expect(countPointsInPath('no numbers')).toBe(0)
    })
  })

  describe('countPointsInPolyline', () => {
    it('считает точки в атрибуте points', () => {
      expect(countPointsInPolyline('10,20 30,40 50,60')).toBe(3)
      expect(countPointsInPolyline('')).toBe(0)
    })
  })

  describe('calculateRemainingPoints', () => {
    it('вычитает текущие точки из лимита', () => {
      expect(calculateRemainingPoints(150, MAX_POINTS_LIMIT)).toBe(350)
      expect(calculateRemainingPoints(500, MAX_POINTS_LIMIT)).toBe(0)
    })
  })

  describe('getCounterThemeStyle', () => {
    it('возвращает красный цвет при критическом остатке (<= 50)', () => {
      const style = getCounterThemeStyle(50)
      expect(style.backgroundColor).toContain('255, 50, 50')
      expect(style.color).toBe('white')
    })

    it('возвращает оранжевый цвет при предупреждении (<= 100)', () => {
      const style = getCounterThemeStyle(80)
      expect(style.backgroundColor).toContain('255, 165, 0')
      expect(style.color).toBe('black')
    })

    it('возвращает дефолтный полупрозрачный темный стиль при достаточном запасе (> 100)', () => {
      const style = getCounterThemeStyle(200)
      expect(style.backgroundColor).toContain('0, 0, 0')
      expect(style.color).toBe('#fff')
    })
  })

  describe('isEditorDrawingStrokeStyle', () => {
    it('распознает стили рисования Народной карты', () => {
      expect(isEditorDrawingStrokeStyle('#ff00ff')).toBe(true)
      expect(isEditorDrawingStrokeStyle('magenta')).toBe(true)
      expect(isEditorDrawingStrokeStyle('#ffff00')).toBe(true)
      expect(isEditorDrawingStrokeStyle('rgba(255, 0, 255, 0.8)')).toBe(true)
      expect(isEditorDrawingStrokeStyle('rgba(80, 227, 194, 1)')).toBe(true)
    })

    it('отклоняет сторонние цвета', () => {
      expect(isEditorDrawingStrokeStyle('#000000')).toBe(false)
      expect(isEditorDrawingStrokeStyle(null)).toBe(false)
      expect(isEditorDrawingStrokeStyle(undefined)).toBe(false)
    })
  })
})
