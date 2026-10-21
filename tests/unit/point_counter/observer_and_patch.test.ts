// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PointCounterUi,
  patchCanvasForPointCounter,
  SvgPointCounterObserver,
} from '@/lib/point_counter'

describe('point_counter svg_observer & canvas_patch', () => {
  let ui: PointCounterUi
  let getLastMapInteractionTime: () => number

  beforeEach(() => {
    document.body.innerHTML = ''
    getLastMapInteractionTime = () => Date.now()
    ui = new PointCounterUi(() => (key) => key)
    ui.ensureCreated()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('SvgPointCounterObserver', () => {
    it('может запускаться и сбрасывать счетчик', () => {
      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })

      const cleanup = observer.start()
      expect(typeof cleanup).toBe('function')

      observer.resetCounter()
      expect(ui.isVisible()).toBe(false)

      cleanup()
    })
  })

  describe('patchCanvasForPointCounter', () => {
    it('патчит CanvasRenderingContext2D.prototype без повторного вызова', () => {
      const mockProto = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      }

      ;(globalThis as any).CanvasRenderingContext2D = () => {}
      ;(globalThis as any).CanvasRenderingContext2D.prototype = mockProto

      patchCanvasForPointCounter({
        ui,
        getLastMapInteractionTime,
      })

      expect((mockProto as any).__nmapCounterPatched__).toBe(true)

      // Повторный вызов безопасен
      patchCanvasForPointCounter({
        ui,
        getLastMapInteractionTime,
      })
      expect((mockProto as any).__nmapCounterPatched__).toBe(true)
    })
  })
})
