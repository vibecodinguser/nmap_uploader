import { defineContentScript } from 'wxt/utils/define-content-script'
import { isNmapsOrigin } from '@/lib/extension_origins'
import { installCanvasMagentaRecolor } from '@/lib/recolor_editor_strokes'
import {
  parseStrokeColorMessage,
  requestStrokeColorFromPage,
  STROKE_COLOR_WINDOW_KEY,
} from '@/lib/stroke_color'

/** Просит редактор перерисовать слой, чтобы canvas-контур взял новый цвет. */
const forceCanvasRepaint = (): void => {
  const resizeEvent = new Event('resize')
  window.dispatchEvent(resizeEvent)
}

const handleStrokeColorMessage = (event: MessageEvent): void => {
  if (event.source === window && isNmapsOrigin(event.origin)) {
    const color = parseStrokeColorMessage(event.data)
    if (color) {
      window[STROKE_COLOR_WINDOW_KEY] = color
      forceCanvasRepaint()
    }
  }
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
    window.addEventListener('message', handleStrokeColorMessage)
    requestStrokeColorFromPage()
  },
})
