import { defineContentScript } from 'wxt/utils/define-content-script'
import { installCanvasMagentaRecolor } from '@/lib/recolor_editor_strokes'
import {
  parseStrokeColorMessage,
  requestStrokeColorFromPage,
  STROKE_COLOR_WINDOW_KEY,
} from '@/lib/stroke_color'

/** Просит редактор перерисовать слой, чтобы canvas-контур взял новый цвет. */
const forceCanvasRepaint = (): void => {
  window.dispatchEvent(new Event('resize'))
}

// WXT подхватывает default export при сборке; статического import нет
// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  allFrames: true,
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installCanvasMagentaRecolor()

    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window) return

      const color = parseStrokeColorMessage(event.data)
      if (!color) return

      window[STROKE_COLOR_WINDOW_KEY] = color
      forceCanvasRepaint()
    })

    requestStrokeColorFromPage()
  },
})
