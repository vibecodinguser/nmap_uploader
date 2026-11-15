/**
 * Панель заметок в DOM Народной карты.
 *
 * Панель — отдельная страница расширения в iframe: стили редактора не
 * протекают внутрь, а наши — наружу. Хост отвечает только за геометрию окна
 * (нижняя кромка, высота, разворот) и за передачу выбранной заметки.
 */
import { browser } from 'wxt/browser'
import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import { NOTES_PANEL_STYLES } from './styles'

export const NOTES_PANEL_HOST_ID = 'nmap-notes-panel'
export const NOTES_PANEL_FRAME_ID = 'nmap-notes-panel-frame'
export const NOTES_PANEL_HANDLE_ID = 'nmap-notes-panel-handle'
export const NOTES_PANEL_STYLES_ID = 'nmap-notes-panel-styles'
export const NOTES_PANEL_HEIGHT_STORAGE_KEY = 'notes_panel_height_px'

/** Сообщения iframe → хост. */
export const NOTES_PANEL_LAYOUT_MESSAGE = 'NOTES_PANEL_LAYOUT'
export const NOTES_PANEL_CLOSE_MESSAGE = 'NOTES_PANEL_CLOSE'
/** Сообщения хост → iframe. */
export const NOTES_PANEL_STATE_MESSAGE = 'NOTES_PANEL_STATE'
export const NOTES_PANEL_SHOW_NOTE_MESSAGE = 'NOTES_PANEL_SHOW_NOTE'

export type NotesPanelLayout = 'compact' | 'full'

const MIN_RATIO = 0.25
const DEFAULT_RATIO = 0.25

export type NotesPanelHost = {
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: () => boolean
  /** Открыть панель на свойствах заметки. */
  showNote: (noteId: string) => void
  destroy: () => void
}

const clampHeight = (height: number): number => {
  const viewport = window.innerHeight
  return Math.min(Math.max(height, viewport * MIN_RATIO), viewport)
}

export const ensureNotesPanelStyles = (): void => {
  ensureInjectedStyle(NOTES_PANEL_STYLES_ID, NOTES_PANEL_STYLES)
}

export const removeNotesPanelStyles = (): void => {
  removeInjectedStyle(NOTES_PANEL_STYLES_ID)
}

export type NotesPanelHostOptions = {
  /** Панель открылась или закрылась: хост сообщает, чтобы убрать «Редактировать». */
  onVisibilityChange?: (open: boolean) => void
}

export const createNotesPanelHost = ({
  onVisibilityChange,
}: NotesPanelHostOptions = {}): NotesPanelHost => {
  let container: HTMLDivElement | null = null
  let frame: HTMLIFrameElement | null = null
  let layout: NotesPanelLayout = 'compact'
  let compactHeight = Math.round(window.innerHeight * DEFAULT_RATIO)
  let dragging = false

  const postState = (): void => {
    const target = frame?.contentWindow
    if (!target) return
    target.postMessage({ action: NOTES_PANEL_STATE_MESSAGE, layout }, '*')
  }

  const applyHeight = (): void => {
    if (!container) return
    container.dataset.layout = layout
    if (layout === 'full') {
      container.style.height = '100vh'
      return
    }
    container.style.height = `${clampHeight(compactHeight)}px`
  }

  const setLayout = (next: NotesPanelLayout): void => {
    layout = next
    applyHeight()
    postState()
  }

  const saveHeight = (): void => {
    browser.storage.local.set({ [NOTES_PANEL_HEIGHT_STORAGE_KEY]: compactHeight }).catch(() => {})
  }

  const handlePointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    event.preventDefault()
    compactHeight = clampHeight(window.innerHeight - event.clientY)
    applyHeight()
  }

  const handlePointerUp = (): void => {
    if (!dragging) return
    dragging = false
    layout = 'compact'
    applyHeight()
    postState()
    saveHeight()
  }

  const handleHandlePointerDown = (event: PointerEvent): void => {
    event.preventDefault()
    dragging = true
    if (layout === 'full') {
      layout = 'compact'
      applyHeight()
      postState()
    }
  }

  const handleWindowMessage = (event: MessageEvent): void => {
    if (!frame || event.source !== frame.contentWindow) return

    const data = event.data as { action?: string; layout?: string } | null
    if (data?.action === NOTES_PANEL_LAYOUT_MESSAGE) {
      setLayout(data.layout === 'full' ? 'full' : 'compact')
      return
    }
    if (data?.action === NOTES_PANEL_CLOSE_MESSAGE) {
      close()
    }
  }

  const build = (): void => {
    if (container) return

    container = document.createElement('div')
    container.id = NOTES_PANEL_HOST_ID
    container.dataset.layout = layout

    const handle = document.createElement('div')
    handle.id = NOTES_PANEL_HANDLE_ID
    handle.setAttribute('role', 'separator')
    handle.setAttribute('aria-orientation', 'horizontal')
    handle.addEventListener('pointerdown', handleHandlePointerDown)

    frame = document.createElement('iframe')
    frame.id = NOTES_PANEL_FRAME_ID
    frame.title = 'Заметки'
    frame.src = browser.runtime.getURL('/notes-panel.html')
    frame.addEventListener('load', postState)

    container.append(handle, frame)
    document.body.appendChild(container)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('message', handleWindowMessage)
  }

  const open = (): void => {
    build()
    if (!container) return
    applyHeight()
    container.dataset.open = 'true'
    postState()
    onVisibilityChange?.(true)
  }

  const close = (): void => {
    if (container?.dataset.open !== 'true') return
    container.dataset.open = 'false'
    onVisibilityChange?.(false)
  }

  const destroy = (): void => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('message', handleWindowMessage)
    container?.remove()
    container = null
    frame = null
    removeNotesPanelStyles()
  }

  const readStoredHeight = async (): Promise<void> => {
    try {
      const stored = await browser.storage.local.get(NOTES_PANEL_HEIGHT_STORAGE_KEY)
      const value = stored[NOTES_PANEL_HEIGHT_STORAGE_KEY]
      if (typeof value === 'number' && Number.isFinite(value)) {
        compactHeight = clampHeight(value)
        applyHeight()
      }
    } catch {
      // Высота — украшение: без неё панель просто откроется по умолчанию.
    }
  }

  readStoredHeight().catch(() => {})

  return {
    open,
    close,
    toggle: () => {
      if (container?.dataset.open === 'true') close()
      else open()
    },
    isOpen: () => container?.dataset.open === 'true',
    showNote: (noteId: string) => {
      open()
      frame?.contentWindow?.postMessage({ action: NOTES_PANEL_SHOW_NOTE_MESSAGE, noteId }, '*')
    },
    destroy,
  }
}
