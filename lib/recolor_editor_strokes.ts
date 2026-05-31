import {
  DEFAULT_STROKE_COLOR,
  readStrokeColorFromPage,
  STROKE_COLOR_WINDOW_KEY,
} from '@/lib/stroke_color'

export { DEFAULT_STROKE_COLOR as TARGET_STROKE } from '@/lib/stroke_color'

const MAGENTA_NAMES = new Set(['magenta', '#f0f', '#ff00ff'])
const RECOLOR_MARKER = 'data-nmap-recolored'
const KNOWN_COLORS_KEY = '__NMAP_KNOWN_STROKE_COLORS__'

declare global {
  interface Window {
    [KNOWN_COLORS_KEY]?: Set<string>
  }
}

let currentTargetStroke = DEFAULT_STROKE_COLOR

const colorToKey = (value: string): string | null => {
  const rgb = parseRgb(value)
  if (!rgb) return null
  return `${rgb.r},${rgb.g},${rgb.b}`
}

const rememberStrokeColor = (color: string): void => {
  if (typeof window === 'undefined') return

  const knownColors = window[KNOWN_COLORS_KEY] ?? new Set<string>()
  const key = colorToKey(color)
  if (key) knownColors.add(key)
  window[KNOWN_COLORS_KEY] = knownColors
}

const isKnownStrokeColor = (value: string | null | undefined): boolean => {
  if (!value || typeof window === 'undefined') return false

  const key = colorToKey(value)
  if (!key) return false
  return window[KNOWN_COLORS_KEY]?.has(key) ?? false
}

const shouldRecolorValue = (value: string | null | undefined): boolean => {
  if (!value || value === 'none') return false
  return isMagentaColor(value) || isKnownStrokeColor(value)
}

const parseRgb = (value: string): { r: number; g: number; b: number } | null => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')

  if (MAGENTA_NAMES.has(normalized)) {
    return { r: 255, g: 0, b: 255 }
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3,8})$/)
  if (hexMatch) {
    const hex = hexMatch[1]
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
      }
    }
    if (hex.length >= 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }
  }

  const rgbMatch = normalized.match(/^rgba?\((\d+),(\d+),(\d+)/)
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    }
  }

  return null
}

export const isMagentaColor = (value: string | null | undefined): boolean => {
  if (!value) return false
  const rgb = parseRgb(value)
  if (!rgb) return false
  return rgb.r === 255 && rgb.g === 0 && rgb.b === 255
}

export const getTargetStroke = (): string =>
  readStrokeColorFromPage() ?? currentTargetStroke

export const setTargetStroke = (color: string): void => {
  rememberStrokeColor(currentTargetStroke)
  rememberStrokeColor(color)

  currentTargetStroke = color

  if (typeof window !== 'undefined') {
    window[STROKE_COLOR_WINDOW_KEY] = color
  }

  refreshRecolorStyles(color)
  recolorPreviouslyStyledElements(document, color)
  recolorKnownStrokeElements(document, color)
  recolorMagentaStrokes(document)
}

export const RECOLOR_STYLE_ID = 'nmap-stroke-recolor'

const buildRecolorStyleSheet = (targetStroke: string): string => `
  ymaps svg [stroke="#ff00ff" i],
  ymaps svg [stroke="#f0f" i],
  ymaps svg [stroke="magenta" i],
  ymaps svg [stroke="rgb(255, 0, 255)" i],
  ymaps svg [stroke="rgba(255, 0, 255, 1)" i],
  .nk-app-view svg [stroke="#ff00ff" i],
  .nk-app-view svg [stroke="#f0f" i],
  .nk-app-view svg [stroke="magenta" i],
  .nk-app-view svg [stroke="rgb(255, 0, 255)" i],
  svg [stroke="#ff00ff" i],
  svg [stroke="#f0f" i],
  svg [stroke="magenta" i],
  svg [stroke="rgb(255, 0, 255)" i] {
    stroke: ${targetStroke} !important;
  }
`

export const injectRecolorStyles = (targetStroke: string = getTargetStroke()): void => {
  const styleContent = buildRecolorStyleSheet(targetStroke)
  const existing = document.getElementById(RECOLOR_STYLE_ID)

  if (existing) {
    existing.textContent = styleContent
    return
  }

  const style = document.createElement('style')
  style.id = RECOLOR_STYLE_ID
  style.textContent = styleContent
  ;(document.head ?? document.documentElement).appendChild(style)
}

const refreshRecolorStyles = (targetStroke: string = getTargetStroke()): void => {
  injectRecolorStyles(targetStroke)
}

export const removeRecolorStyles = (): void => {
  document.getElementById(RECOLOR_STYLE_ID)?.remove()
}

const isExtensionShadowNode = (node: Node): boolean => {
  const root = node.getRootNode()
  if (!(root instanceof ShadowRoot)) return false
  return root.host instanceof HTMLElement && root.host.tagName.toLowerCase() === 'nmap-sidebar'
}

const applyTargetColor = (element: SVGElement, prop: 'stroke' | 'fill', color: string): void => {
  element.setAttribute(prop, color)
  element.style.setProperty(prop, color, 'important')
  element.setAttribute(RECOLOR_MARKER, '1')
}

const recolorInlineStyle = (styleValue: string, targetStroke: string): string | null => {
  let next = styleValue
  let changed = false

  for (const prop of ['stroke', 'fill'] as const) {
    const pattern = new RegExp(`(${prop}\\s*:\\s*)([^;]+)`, 'gi')
    next = next.replace(pattern, (match, prefix: string, color: string) => {
      if (!shouldRecolorValue(color)) return match
      changed = true
      return `${prefix}${targetStroke}`
    })
  }

  return changed ? next : null
}

const recolorSvgElement = (element: Element, targetStroke: string = getTargetStroke()): void => {
  if (isExtensionShadowNode(element)) return
  if (!(element instanceof SVGElement)) return

  for (const attr of ['stroke', 'fill'] as const) {
    const value = element.getAttribute(attr)
    if (shouldRecolorValue(value)) {
      applyTargetColor(element, attr, targetStroke)
    }
  }

  const computed = getComputedStyle(element)
  if (shouldRecolorValue(computed.stroke)) {
    applyTargetColor(element, 'stroke', targetStroke)
  }
  if (shouldRecolorValue(computed.fill) && computed.fill !== 'none') {
    applyTargetColor(element, 'fill', targetStroke)
  }

  const inlineStyle = element.getAttribute('style')
  if (!inlineStyle) return

  const recoloredStyle = recolorInlineStyle(inlineStyle, targetStroke)
  if (recoloredStyle) {
    element.setAttribute('style', recoloredStyle)
    element.setAttribute(RECOLOR_MARKER, '1')
  }
}

const updateMarkedElementColor = (element: Element, toColor: string): void => {
  if (!(element instanceof SVGElement)) return
  if (isExtensionShadowNode(element)) return
  if (element.getAttribute(RECOLOR_MARKER) !== '1') return

  for (const prop of ['stroke', 'fill'] as const) {
    const value = element.getAttribute(prop)
    if (value === 'none') continue
    if (isMagentaColor(value)) continue
    if (!value && !element.style.getPropertyValue(prop)) continue
    applyTargetColor(element, prop, toColor)
  }

  const inlineStyle = element.getAttribute('style')
  if (!inlineStyle) return

  let next = inlineStyle
  let changed = false

  for (const prop of ['stroke', 'fill'] as const) {
    const pattern = new RegExp(`(${prop}\\s*:\\s*)([^;]+)`, 'gi')
    next = next.replace(pattern, (match, prefix: string, color: string) => {
      if (isMagentaColor(color)) return match
      changed = true
      return `${prefix}${toColor}`
    })
  }

  if (changed) {
    element.setAttribute('style', next)
  }
}

const collectRoots = (root: ParentNode): ParentNode[] => {
  const roots: ParentNode[] = [root]

  const elements =
    root instanceof Document
      ? root.querySelectorAll('*')
      : root instanceof Element
        ? root.querySelectorAll('*')
        : []

  for (const element of elements) {
    if (element.shadowRoot) {
      roots.push(element.shadowRoot)
      roots.push(...collectRoots(element.shadowRoot))
    }
  }

  if (root instanceof Document) {
    for (const iframe of root.querySelectorAll('iframe')) {
      try {
        const frameDocument = iframe.contentDocument
        if (!frameDocument) continue
        roots.push(frameDocument)
        roots.push(...collectRoots(frameDocument))
      } catch {
        // cross-origin iframe
      }
    }
  }

  return roots
}

const recolorMagentaStrokesInRoot = (root: ParentNode, targetStroke: string = getTargetStroke()): void => {
  if (root instanceof Element && isExtensionShadowNode(root)) return

  const scope =
    root instanceof Document
      ? root.documentElement
      : root instanceof ShadowRoot
        ? root
        : root

  if (scope instanceof Element) {
    if (scope instanceof SVGElement || scope.tagName.toLowerCase() === 'svg') {
      recolorSvgElement(scope, targetStroke)
    }
    for (const element of scope.querySelectorAll('svg, svg *')) {
      recolorSvgElement(element, targetStroke)
    }
  }
}

const recolorKnownStrokeElements = (documentRoot: Document, targetStroke: string): void => {
  for (const root of collectRoots(documentRoot)) {
    const scope =
      root instanceof Document
        ? root.documentElement
        : root instanceof ShadowRoot
          ? root
          : root

    if (!(scope instanceof Element)) continue

    for (const element of scope.querySelectorAll('svg, svg *')) {
      recolorSvgElement(element, targetStroke)
    }
  }
}

const recolorPreviouslyStyledElements = (documentRoot: Document, toColor: string): void => {
  for (const root of collectRoots(documentRoot)) {
    const scope =
      root instanceof Document
        ? root.documentElement
        : root instanceof ShadowRoot
          ? root
          : root

    if (!(scope instanceof Element)) continue

    for (const element of scope.querySelectorAll(`[${RECOLOR_MARKER}]`)) {
      updateMarkedElementColor(element, toColor)
    }
  }
}

export const recolorMagentaStrokes = (documentRoot: Document): void => {
  for (const root of collectRoots(documentRoot)) {
    recolorMagentaStrokesInRoot(root)
  }
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
  if (typeof CanvasRenderingContext2D === 'undefined') return

  const proto = CanvasRenderingContext2D.prototype
  const marker = '__nmapRecolorPatched__'
  if ((proto as unknown as Record<string, boolean>)[marker]) return
  ;(proto as unknown as Record<string, boolean>)[marker] = true

  const replaceMagentaStyle = (ctx: CanvasRenderingContext2D, prop: 'strokeStyle' | 'fillStyle') => {
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
