/**
 * Управление известными цветами и CSS-стилями перекраски контуров.
 */
import {
  buildRecolorStyleSheet,
  colorToKey,
  isMagentaColor,
  KNOWN_COLORS_KEY,
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
