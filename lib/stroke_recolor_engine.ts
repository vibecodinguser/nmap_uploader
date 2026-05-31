import { browser } from 'wxt/browser'
import { setTargetStroke, startEditorStrokeRecolor } from '@/lib/recolor_editor_strokes'
import {
  getEffectiveStrokeColor,
  isStrokeColorRequest,
  postStrokeColorMessage,
  publishStrokeColorToPage,
  STROKE_COLOR_CHANGED_EVENT,
  STROKE_COLOR_STORAGE_KEY,
} from '@/lib/stroke_color'
import { getStoredStrokeColorRaw } from '@/lib/stroke_color_settings'

const ENGINE_FLAG = '__NMAP_STROKE_RECOLOR_ENGINE__'

declare global {
  interface Window {
    [ENGINE_FLAG]?: 'active'
    __nmapApplyStrokeColor?: (color: string) => void
  }
}

let stopRecolor: (() => void) | undefined
let cleanupListeners: (() => void) | undefined

export const applyStrokeColorOnPage = (color: string): void => {
  publishStrokeColorToPage(color)
  setTargetStroke(color)
}

const bindStrokeColorListeners = (): (() => void) => {
  const handleStrokeColorChanged = (event: Event): void => {
    const color = (event as CustomEvent<{ color?: string }>).detail?.color
    if (!color) return
    setTargetStroke(color)
  }

  window.addEventListener(STROKE_COLOR_CHANGED_EVENT, handleStrokeColorChanged)

  const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local' || !(STROKE_COLOR_STORAGE_KEY in changes)) return

    const nextValue = changes[STROKE_COLOR_STORAGE_KEY]?.newValue
    const raw = typeof nextValue === 'string' ? nextValue : ''
    applyStrokeColorOnPage(getEffectiveStrokeColor(raw))
  }

  browser.storage.onChanged.addListener(handleStorageChange)

  const handleRuntimeMessage = (message: { action?: string; color?: string; raw?: string }) => {
    if (message?.action !== 'applyStrokeColor') return

    const color =
      typeof message.color === 'string' ? message.color : getEffectiveStrokeColor(message.raw)

    applyStrokeColorOnPage(color)
  }

  browser.runtime.onMessage.addListener(handleRuntimeMessage)

  const handleWindowMessage = (event: MessageEvent): void => {
    if (event.source !== window) return
    if (!isStrokeColorRequest(event.data)) return

    getStoredStrokeColorRaw()
      .then((raw) => postStrokeColorMessage(getEffectiveStrokeColor(raw)))
      .catch((error: unknown) => {
        console.warn('[nmap_uploader] stroke color reply failed:', error)
      })
  }

  window.addEventListener('message', handleWindowMessage)

  return () => {
    window.removeEventListener(STROKE_COLOR_CHANGED_EVENT, handleStrokeColorChanged)
    window.removeEventListener('message', handleWindowMessage)
    browser.storage.onChanged.removeListener(handleStorageChange)
    browser.runtime.onMessage.removeListener(handleRuntimeMessage)
  }
}

/** Запускает движок перекраски один раз на вкладке. */
export const ensureStrokeRecolorEngine = (): void => {
  if (typeof window === 'undefined') return
  if (window[ENGINE_FLAG] === 'active') return

  window[ENGINE_FLAG] = 'active'
  window.__nmapApplyStrokeColor = applyStrokeColorOnPage
  stopRecolor = startEditorStrokeRecolor()
  cleanupListeners = bindStrokeColorListeners()

  getStoredStrokeColorRaw()
    .then((raw) => applyStrokeColorOnPage(getEffectiveStrokeColor(raw)))
    .catch((error: unknown) => {
      console.warn('[nmap_uploader] stroke color init failed:', error)
    })
}

export const teardownStrokeRecolorEngine = (): void => {
  cleanupListeners?.()
  cleanupListeners = undefined
  stopRecolor?.()
  stopRecolor = undefined

  if (typeof window !== 'undefined') {
    window[ENGINE_FLAG] = undefined
    window.__nmapApplyStrokeColor = undefined
  }
}

/** Применяет цвет через общий bridge на window (работает из любого content script). */
export const applyStrokeColorViaWindow = (color: string): void => {
  if (typeof window === 'undefined') return

  if (window.__nmapApplyStrokeColor) {
    window.__nmapApplyStrokeColor(color)
    return
  }

  ensureStrokeRecolorEngine()
  applyStrokeColorOnPage(color)
}
