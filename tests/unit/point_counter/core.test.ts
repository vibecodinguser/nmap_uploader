import { describe, expect, it } from 'vitest'
import {
  calculateExceededPoints,
  calculateRemainingPoints,
  countPointsInPath,
  countPointsInPolyline,
  getCounterStatus,
  getCounterThemeStyle,
  isEditorDrawingStrokeStyle,
  MAX_POINTS_LIMIT,
  normalizeActiveDrawingPoints,
} from '@/lib/point_counter/core'

describe('point_counter/core', () => {
  describe('normalizeActiveDrawingPoints', () => {
    it('возвращает 0 или 1 точку без изменений', () => {
      expect(normalizeActiveDrawingPoints(0)).toBe(0)
      expect(normalizeActiveDrawingPoints(1)).toBe(1)
    })

    it('вычитает 1 динамическую точку курсора для линий и полигонов от 2 точек', () => {
      expect(normalizeActiveDrawingPoints(2)).toBe(1)
      expect(normalizeActiveDrawingPoints(5)).toBe(4)
      expect(normalizeActiveDrawingPoints(500)).toBe(499)
    })
  })

  describe('countPointsInPath', () => {
    it('считает пары координат в строке d', () => {
      expect(countPointsInPath('M 10 20 L 30 40 L 50 60')).toBe(3)
      expect(countPointsInPath('M10,20L30,40')).toBe(2)
      expect(countPointsInPath('M 10.5 -20.2 L -30.1 40.8')).toBe(2)
      expect(countPointsInPath('M.5 .5 L-.3 .8')).toBe(2)
      expect(countPointsInPath('')).toBe(0)
      expect(countPointsInPath('no numbers')).toBe(0)
    })

    it('корректно считает вершины в путях со скруглениями (кривые Безье и дуги)', () => {
      // 1 точка M + 2 точки L + 1 вершина дуги Безье (команда C из 6 параметров) = 4 вершины
      expect(countPointsInPath('M 10 20 L 30 40 L 50 60 C 55 65 70 80 90 100')).toBe(4)

      // 1 точка M + 1 дуга A (7 параметров) = 2 вершины
      expect(countPointsInPath('M 0 0 A 25 25 0 0 1 50 50')).toBe(2)

      // Путь с горизонтальными и вертикальными сегментами (H, V)
      expect(countPointsInPath('M 0 0 H 50 V 50 Z')).toBe(3)
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

  describe('calculateExceededPoints', () => {
    it('считает количество точек свыше лимита', () => {
      expect(calculateExceededPoints(490, MAX_POINTS_LIMIT)).toBe(0)
      expect(calculateExceededPoints(500, MAX_POINTS_LIMIT)).toBe(0)
      expect(calculateExceededPoints(501, MAX_POINTS_LIMIT)).toBe(1)
      expect(calculateExceededPoints(515, MAX_POINTS_LIMIT)).toBe(15)
    })
  })

  describe('getCounterStatus', () => {
    it('возвращает remaining при запасе вершин', () => {
      expect(getCounterStatus(100)).toEqual({ type: 'remaining', count: 400 })
      expect(getCounterStatus(499)).toEqual({ type: 'remaining', count: 1 })
    })

    it('возвращает limitReached при точном достижении лимита (500)', () => {
      expect(getCounterStatus(500)).toEqual({ type: 'limitReached' })
    })

    it('возвращает limitExceeded при превышении лимита', () => {
      expect(getCounterStatus(501)).toEqual({ type: 'limitExceeded', count: 1 })
      expect(getCounterStatus(525)).toEqual({ type: 'limitExceeded', count: 25 })
    })
  })

  describe('getCounterThemeStyle', () => {
    it('возвращает красный цвет при критическом остатке (<= 50)', () => {
      const style = getCounterThemeStyle(50)
      expect(style.backgroundColor).toContain('235, 32, 32')
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
