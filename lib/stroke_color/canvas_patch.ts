/**
 * Перехват контекста Canvas 2D для перекраски стилей рисования magenta.
 */
import { isMagentaColor } from '@/lib/stroke_color/recolor_core'

export const installCanvasMagentaRecolor = (getTargetStroke: () => string): void => {
  if (typeof CanvasRenderingContext2D === 'undefined') return

  const proto = CanvasRenderingContext2D.prototype
  const marker = '__nmapRecolorPatched__'
  if ((proto as unknown as Record<string, boolean>)[marker]) return
  ;(proto as unknown as Record<string, boolean>)[marker] = true

  const replaceMagentaStyle = (
    ctx: CanvasRenderingContext2D,
    prop: 'strokeStyle' | 'fillStyle',
  ) => {
    const value = ctx[prop]
    if (typeof value === 'string' && isMagentaColor(value)) {
      ctx[prop] = getTargetStroke()
    }
  }

  const wrap = <T extends (...args: never[]) => unknown>(
    original: T,
    before: (ctx: CanvasRenderingContext2D) => void,
  ): T =>
    function (this: CanvasRenderingContext2D, ...args: Parameters<T>) {
      before(this)
      return original.apply(this, args)
    } as T

  proto.stroke = wrap(proto.stroke, (ctx) => {
    replaceMagentaStyle(ctx, 'strokeStyle')
  })

  proto.fill = wrap(proto.fill, (ctx) => {
    replaceMagentaStyle(ctx, 'fillStyle')
  })

  proto.strokeRect = wrap(proto.strokeRect, (ctx) => {
    replaceMagentaStyle(ctx, 'strokeStyle')
  })

  proto.fillRect = wrap(proto.fillRect, (ctx) => {
    replaceMagentaStyle(ctx, 'fillStyle')
  })
}
