/**
 * Фасад сервиса перекраски обводок Народной карты.
 * Обеспечивает полную обратную совместимость для существующих потребителей.
 */
import {
  DEFAULT_STROKE_COLOR,
  readStrokeColorFromPage,
  STROKE_COLOR_WINDOW_KEY,
} from '@/lib/stroke_color'
import {
  injectRecolorStyles as injectRecolorStylesDom,
  installCanvasMagentaRecolor as installCanvasMagentaRecolorInternal,
  recolorKnownStrokeElements,
  recolorMagentaStrokes as recolorMagentaStrokesDom,
  recolorPreviouslyStyledElements,
  rememberStrokeColor,
  removeRecolorStyles,
} from '@/lib/stroke_color/index'

let currentTargetStroke = DEFAULT_STROKE_COLOR

const getTargetStroke = (): string => readStrokeColorFromPage() ?? currentTargetStroke

const injectRecolorStyles = (targetStroke: string = getTargetStroke()): void => {
  injectRecolorStylesDom(targetStroke)
}

const recolorMagentaStrokes = (documentRoot: Document): void => {
  recolorMagentaStrokesDom(documentRoot, getTargetStroke())
}

export const setTargetStroke = (color: string): void => {
  rememberStrokeColor(currentTargetStroke)
  rememberStrokeColor(color)

  currentTargetStroke = color

  if (typeof window !== 'undefined') {
    window[STROKE_COLOR_WINDOW_KEY] = color
  }

  injectRecolorStyles(color)
  recolorPreviouslyStyledElements(document, color)
  recolorKnownStrokeElements(document, color)
  recolorMagentaStrokes(document)
}

/** Подменяет #ff00ff на выбранный цвет в SVG карты. Возвращает функцию очистки. */
export const startEditorStrokeRecolor = (): (() => void) => {
  rememberStrokeColor(DEFAULT_STROKE_COLOR)

  injectRecolorStyles()
  recolorMagentaStrokes(document)

  let frameId = 0
  const scheduleRecolor = () => {
    cancelAnimationFrame(frameId)
    frameId = requestAnimationFrame(() => {
      recolorMagentaStrokes(document)
    })
  }

  const observer = new MutationObserver(() => {
    scheduleRecolor()
  })

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['stroke', 'fill', 'style', 'class'],
  })

  const intervalId = window.setInterval(scheduleRecolor, 1000)

  return () => {
    cancelAnimationFrame(frameId)
    window.clearInterval(intervalId)
    observer.disconnect()
    removeRecolorStyles()
  }
}

/** Перехват Canvas 2D — редактор может рисовать контур через canvas, а не SVG. */
export const installCanvasMagentaRecolor = (): void => {
  installCanvasMagentaRecolorInternal(getTargetStroke)
}
