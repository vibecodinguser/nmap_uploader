import { defineContentScript } from 'wxt/utils/define-content-script'
import { ensureStrokeRecolorEngine, teardownStrokeRecolorEngine } from '@/lib/stroke_recolor_engine'

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  allFrames: true,
  runAt: 'document_start',
  main(ctx) {
    ensureStrokeRecolorEngine()
    ctx.onInvalidated(teardownStrokeRecolorEngine)
  },
})
