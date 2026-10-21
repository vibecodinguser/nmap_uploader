import { isEditorDrawingStrokeStyle } from './core'
import type { PointCounterUi } from './dom_ui'

export interface CanvasCounterPatchOptions {
  ui: PointCounterUi
  getLastMapInteractionTime: () => number
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

  if (typeof document !== 'undefined') {
    document.addEventListener('dblclick', () => {
      canvasLastShownPoints = 0
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') canvasLastShownPoints = 0
    })
  }

  const originalBeginPath = proto.beginPath
  const originalMoveTo = proto.moveTo
  const originalLineTo = proto.lineTo
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

  proto.stroke = function (this: CanvasRenderingContext2D, ...args: [path?: Path2D]) {
    if (Date.now() - getLastMapInteractionTime() > 5000) {
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
            const isJumpFromZero = canvasLastShownPoints === 0 && maxPointsForColor > 1
            const isBigJump =
              canvasLastShownPoints > 0 && maxPointsForColor - canvasLastShownPoints > 2

            if (isJumpFromZero || isBigJump) {
              ui.hide()
              canvasLastShownPoints = 0
            } else if (maxPointsForColor === 2 && canvasLastShownPoints > 2) {
              // Игнорируем скачок вниз до 2
            } else {
              ui.show(maxPointsForColor)
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
