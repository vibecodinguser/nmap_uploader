/**
 * Короткое сообщение о результате разреза поверх карты.
 *
 * Своей плашки у редактора нет, а в тулбаре места для текста не хватает.
 * Сообщение живёт в отдельном узле с префиксом `nmap-`, поэтому не
 * пересекается с разметкой хоста.
 */

import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import toastCss from './toast.css?inline'

export const CUT_TOAST_ID = 'nmap-cut-toast'
export const CUT_TOAST_STYLE_ID = 'nmap-cut-toast-style'

/** Сколько сообщение висит на экране, мс. */
export const TOAST_VISIBLE_MS = 2500

let hideTimer: ReturnType<typeof setTimeout> | null = null

const ensureToast = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null

  ensureInjectedStyle(CUT_TOAST_STYLE_ID, toastCss)

  const existing = document.getElementById(CUT_TOAST_ID)
  if (existing) return existing

  const toast = document.createElement('div')
  toast.id = CUT_TOAST_ID
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  toast.hidden = true
  document.body.appendChild(toast)
  return toast
}

/** Показывает сообщение и прячет его через `TOAST_VISIBLE_MS`. */
export const showCutMessage = (text: string): void => {
  const toast = ensureToast()
  if (!toast) return

  toast.textContent = text
  toast.hidden = false

  if (hideTimer !== null) {
    clearTimeout(hideTimer)
  }
  hideTimer = setTimeout(() => {
    hideTimer = null
    toast.hidden = true
  }, TOAST_VISIBLE_MS)
}

/** Убирает сообщение, таймер и вставленный стиль. */
export const removeCutMessage = (): void => {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (typeof document === 'undefined') return
  document.getElementById(CUT_TOAST_ID)?.remove()
  removeInjectedStyle(CUT_TOAST_STYLE_ID)
}
