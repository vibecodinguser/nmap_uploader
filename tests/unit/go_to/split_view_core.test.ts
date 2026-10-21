import { describe, expect, it } from 'vitest'
import {
  CURSOR_MARKER_RADIUS,
  calculateWheelZoomSteps,
  clampMarkerPosition,
  isStaleNakarteZoomEcho,
  WHEEL_ZOOM_STEP_THRESHOLD,
} from '@/lib/go_to_split_view/core'

describe('go_to_split_view/core', () => {
  describe('clampMarkerPosition', () => {
    const panel = { width: 500, height: 400 }

    it('возвращает null, если координаты выходят за границы панели', () => {
      expect(clampMarkerPosition({ x: -1, y: 100 }, panel)).toBeNull()
      expect(clampMarkerPosition({ x: 501, y: 100 }, panel)).toBeNull()
      expect(clampMarkerPosition({ x: 100, y: -1 }, panel)).toBeNull()
      expect(clampMarkerPosition({ x: 100, y: 401 }, panel)).toBeNull()
    })

    it('ограничивает позицию радиусом маркера возле левого/верхнего края', () => {
      const clamped = clampMarkerPosition({ x: 2, y: 3 }, panel)
      expect(clamped).toEqual({
        x: CURSOR_MARKER_RADIUS,
        y: CURSOR_MARKER_RADIUS,
      })
    })

    it('ограничивает позицию радиусом маркера возле правого/нижнего края', () => {
      const clamped = clampMarkerPosition({ x: 498, y: 399 }, panel)
      expect(clamped).toEqual({
        x: 500 - CURSOR_MARKER_RADIUS,
        y: 400 - CURSOR_MARKER_RADIUS,
      })
    })

    it('сохраняет точные координаты внутри допустимого диапазона', () => {
      const clamped = clampMarkerPosition({ x: 250, y: 200 }, panel)
      expect(clamped).toEqual({ x: 250, y: 200 })
    })
  })

  describe('isStaleNakarteZoomEcho', () => {
    const pending = { latitude: 55.75, longitude: 37.61, zoom: 14 }

    it('возвращает false, если зум совпадает', () => {
      const incoming = { latitude: 55.75, longitude: 37.61, zoom: 14 }
      expect(isStaleNakarteZoomEcho(incoming, pending)).toBe(false)
    })

    it('возвращает true, если координаты центра совпадают в пределах эпсилон, но зум отличается', () => {
      const incoming = { latitude: 55.75001, longitude: 37.61001, zoom: 13 }
      expect(isStaleNakarteZoomEcho(incoming, pending)).toBe(true)
    })

    it('возвращает false, если координаты центра сильно отличаются', () => {
      const incoming = { latitude: 55.8, longitude: 37.7, zoom: 13 }
      expect(isStaleNakarteZoomEcho(incoming, pending)).toBe(false)
    })
  })

  describe('calculateWheelZoomSteps', () => {
    it('не меняет шаги при дельте меньше порога', () => {
      const result = calculateWheelZoomSteps(20, 0)
      expect(result).toEqual({ steps: 0, newAccumulator: 20 })
    })

    it('накапливает дельту и возвращает шаг при превышении порога', () => {
      const result = calculateWheelZoomSteps(35, 20, WHEEL_ZOOM_STEP_THRESHOLD)
      expect(result).toEqual({ steps: 1, newAccumulator: 5 })
    })

    it('корректно обрабатывает отрицательную дельту', () => {
      const result = calculateWheelZoomSteps(-60, 0, WHEEL_ZOOM_STEP_THRESHOLD)
      expect(result).toEqual({ steps: -1, newAccumulator: -10 })
    })
  })
})
