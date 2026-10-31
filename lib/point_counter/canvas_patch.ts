import {
  isEditorDrawingStrokeStyle,
  MAP_INTERACTION_TIMEOUT_MS,
  MAX_OBSERVED_POINTS,
  normalizeActiveDrawingPoints,
} from './core'
import type { PointCounterUi } from './dom_ui'

export interface CanvasCounterPatchOptions {
  ui: PointCounterUi
  getLastMapInteractionTime: () => number
}

let resetCanvasCounterFn: (() => void) | null = null

export const resetCanvasPointCounter = (): void => {
  resetCanvasCounterFn?.()
}

export const patchCanvasForPointCounter = ({
  ui,
  getLastMapInteractionTime,
}: CanvasCounterPatchOptions): void => {
  if (typeof CanvasRenderingContext2D === 'undefined') return

  const proto = CanvasRenderingContext2D.prototype
  const marker = '__nmapCounterPatched__'
  const protoRecord = proto as unknown as Record<string, boolean>
  if (protoRecord[marker]) return
  protoRecord[marker] = true

  let currentPoints = 0
  let canvasLastShownPoints = 0
  let maxPointsForColor = 0
  let resetTimeout: number | null = null

  const resetCanvasCounter = (): void => {
    canvasLastShownPoints = 0
    maxPointsForColor = 0
    if (resetTimeout && typeof window !== 'undefined') {
      window.clearTimeout(resetTimeout)
      resetTimeout = null
    }
  }

  resetCanvasCounterFn = resetCanvasCounter

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') resetCanvasCounter()
      },
      true,
    )
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
      if (event.data?.action === 'RESET_POINT_COUNTER') {
        resetCanvasCounter()
      }
    })
  }

  const originalBeginPath = proto.beginPath
  const originalMoveTo = proto.moveTo
  const originalLineTo = proto.lineTo
  const originalBezierCurveTo = proto.bezierCurveTo
  const originalQuadraticCurveTo = proto.quadraticCurveTo
  const originalArcTo = proto.arcTo
  const originalArc = proto.arc
  const originalStroke = proto.stroke

  proto.beginPath = function (
    this: CanvasRenderingContext2D,
    ...args: Parameters<typeof originalBeginPath>
  ) {
    currentPoints = 0
    return originalBeginPath.apply(this, args)
  }

  proto.moveTo = function (
    this: CanvasRenderingContext2D,
    ...args: Parameters<typeof originalMoveTo>
  ) {
    if (currentPoints === 0) currentPoints = 1
    return originalMoveTo.apply(this, args)
  }

  proto.lineTo = function (
    this: CanvasRenderingContext2D,
    ...args: Parameters<typeof originalLineTo>
  ) {
    currentPoints++
    return originalLineTo.apply(this, args)
  }

  if (originalBezierCurveTo) {
    proto.bezierCurveTo = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof originalBezierCurveTo>
    ) {
      currentPoints++
      return originalBezierCurveTo.apply(this, args)
    }
  }

  if (originalQuadraticCurveTo) {
    proto.quadraticCurveTo = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof originalQuadraticCurveTo>
    ) {
      currentPoints++
      return originalQuadraticCurveTo.apply(this, args)
    }
  }

  if (originalArcTo) {
    proto.arcTo = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof originalArcTo>
    ) {
      currentPoints++
      return originalArcTo.apply(this, args)
    }
  }

  if (originalArc) {
    proto.arc = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof originalArc>) {
      currentPoints++
      return originalArc.apply(this, args)
    }
  }

  if (originalBezierCurveTo) {
    proto.bezierCurveTo = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof originalBezierCurveTo>
    ) {
      currentPoints++
      return originalBezierCurveTo.apply(this, args)
    }
  }

  if (originalQuadraticCurveTo) {
    proto.quadraticCurveTo = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof originalQuadraticCurveTo>
    ) {
      currentPoints++
      return originalQuadraticCurveTo.apply(this, args)
    }
  }

  if (originalArcTo) {
    proto.arcTo = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof originalArcTo>
    ) {
      currentPoints++
      return originalArcTo.apply(this, args)
    }
  }

  if (originalArc) {
    proto.arc = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof originalArc>) {
      currentPoints++
      return originalArc.apply(this, args)
    }
  }

  proto.stroke = function (this: CanvasRenderingContext2D, ...args: [path?: Path2D]) {
    if (Date.now() - getLastMapInteractionTime() > MAP_INTERACTION_TIMEOUT_MS) {
      return (originalStroke as (...a: unknown[]) => void).apply(this, args)
    }

    const strokeStyle = this.strokeStyle

    if (currentPoints > 0 && isEditorDrawingStrokeStyle(strokeStyle)) {
      if (currentPoints > maxPointsForColor) {
        maxPointsForColor = currentPoints
      }

      if (!resetTimeout && typeof window !== 'undefined') {
        resetTimeout = window.setTimeout(() => {
          if (maxPointsForColor >= 1 && maxPointsForColor !== canvasLastShownPoints) {
            const isExceedingLimit = maxPointsForColor > MAX_OBSERVED_POINTS

            if (isExceedingLimit) {
              ui.hide()
              canvasLastShownPoints = 0
            } else if (maxPointsForColor <= 2 && canvasLastShownPoints > 2) {
              // Игнорируем скачок вниз до 1-2 точек (отрисовка вспомогательных отрезков/ручек)
            } else {
              const placedPoints = normalizeActiveDrawingPoints(maxPointsForColor)
              ui.show(placedPoints)
              canvasLastShownPoints = maxPointsForColor
            }
          }
          maxPointsForColor = 0
          resetTimeout = null
        }, 50)
      }
    }

    return (originalStroke as (...a: unknown[]) => void).apply(this, args)
  }
}
