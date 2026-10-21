/**
 * DOM-адаптер для поиска и перекраски SVG-элементов Народной карты.
 */
import {
  buildRecolorStyleSheet,
  colorToKey,
  isMagentaColor,
  KNOWN_COLORS_KEY,
  RECOLOR_MARKER,
  RECOLOR_STYLE_ID,
} from '@/lib/stroke_color/recolor_core'

declare global {
  interface Window {
    [KNOWN_COLORS_KEY]?: Set<string>
  }
}

export const rememberStrokeColor = (color: string): void => {
  if (typeof window === 'undefined') return

  const knownColors = window[KNOWN_COLORS_KEY] ?? new Set<string>()
  const key = colorToKey(color)
  if (key) knownColors.add(key)
  window[KNOWN_COLORS_KEY] = knownColors
}

export const isKnownStrokeColor = (value: string | null | undefined): boolean => {
  if (!value || typeof window === 'undefined') return false

  const key = colorToKey(value)
  if (!key) return false
  return window[KNOWN_COLORS_KEY]?.has(key) ?? false
}

export const shouldRecolorValue = (value: string | null | undefined): boolean => {
  if (!value || value === 'none') return false
  return isMagentaColor(value) || isKnownStrokeColor(value)
}

export const injectRecolorStyles = (targetStroke: string): void => {
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

export const removeRecolorStyles = (): void => {
  document.getElementById(RECOLOR_STYLE_ID)?.remove()
}

export const isExtensionShadowNode = (node: Node): boolean => {
  const root = node.getRootNode()
  if (!(root instanceof ShadowRoot)) return false
  return root.host instanceof HTMLElement && root.host.tagName.toLowerCase() === 'nmap-sidebar'
}

export const applyTargetColor = (
  element: SVGElement,
  prop: 'stroke' | 'fill',
  color: string,
): void => {
  element.setAttribute(prop, color)
  element.style.setProperty(prop, color, 'important')
  element.setAttribute(RECOLOR_MARKER, '1')
}

export const recolorInlineStyle = (styleValue: string, targetStroke: string): string | null => {
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

export const recolorSvgElement = (element: Element, targetStroke: string): void => {
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

export const updateMarkedElementColor = (element: Element, toColor: string): void => {
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

export const collectRoots = (root: ParentNode): ParentNode[] => {
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

export const recolorMagentaStrokesInRoot = (root: ParentNode, targetStroke: string): void => {
  if (root instanceof Element && isExtensionShadowNode(root)) return

  const scope =
    root instanceof Document ? root.documentElement : root instanceof ShadowRoot ? root : root

  if (scope instanceof Element) {
    if (scope instanceof SVGElement || scope.tagName.toLowerCase() === 'svg') {
      recolorSvgElement(scope, targetStroke)
    }
    for (const element of scope.querySelectorAll('svg, svg *')) {
      recolorSvgElement(element, targetStroke)
    }
  }
}

export const recolorKnownStrokeElements = (documentRoot: Document, targetStroke: string): void => {
  for (const root of collectRoots(documentRoot)) {
    const scope =
      root instanceof Document ? root.documentElement : root instanceof ShadowRoot ? root : root

    if (!(scope instanceof Element)) continue

    for (const element of scope.querySelectorAll('svg, svg *')) {
      recolorSvgElement(element, targetStroke)
    }
  }
}

export const recolorPreviouslyStyledElements = (documentRoot: Document, toColor: string): void => {
  for (const root of collectRoots(documentRoot)) {
    const scope =
      root instanceof Document ? root.documentElement : root instanceof ShadowRoot ? root : root

    if (!(scope instanceof Element)) continue

    for (const element of scope.querySelectorAll(`[${RECOLOR_MARKER}]`)) {
      updateMarkedElementColor(element, toColor)
    }
  }
}

export const recolorMagentaStrokes = (documentRoot: Document, targetStroke: string): void => {
  for (const root of collectRoots(documentRoot)) {
    recolorMagentaStrokesInRoot(root, targetStroke)
  }
}
