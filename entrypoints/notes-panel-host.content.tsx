import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { createTranslator, getStoredLocale } from '@/lib/i18n'
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale'
import {
  NMAPS_CANCEL_PICK_POINT_EVENT,
  NMAPS_POINT_PICKED_EVENT,
  notifyCancelPickPoint,
  notifyStartPickPoint,
  parsePointPickedEvent,
} from '@/lib/nmaps_pick_point_notify'
import type { NotesSnapshotPayload } from '@/lib/notes/messages'
import {
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_HIDDEN_CHANGED_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_RENDER_ACTION,
  NOTES_SELECT_ACTION,
  NOTES_START_DRAW_ACTION,
  NOTES_VISIBILITY_ACTION,
} from '@/lib/notes/messages'
import type { LonLat, NoteKind } from '@/lib/notes/types'
import {
  NMAPS_NOTE_SELECTED_EVENT,
  NMAPS_RENDER_NOTES_EVENT,
  NMAPS_SELECT_NOTE_EVENT,
  snapshotToLayerInput,
} from '@/lib/notes_layer'
import {
  ensureNotesEditButton,
  NOTES_EDIT_BUTTON_WRAPPER_ID,
  removeNotesEditButton,
} from '@/lib/notes_panel/edit_button'
import { NMAPS_TOGGLE_NOTES_PANEL_EVENT } from '@/lib/notes_panel/events'
import { createNotesPanelHost, ensureNotesPanelStyles } from '@/lib/notes_panel/host'

type DrawableKind = Extract<NoteKind, 'Point' | 'Line' | 'Polygon'>

const PICKER_GEOM_TYPES: Record<DrawableKind, string> = {
  Point: 'Point',
  Line: 'LineString',
  Polygon: 'Polygon',
}

/** Переставляет кнопку «Редактировать», если нативные контролы перерисовались. */
const BUTTON_SYNC_INTERVAL_MS = 1000

const dispatchToPage = (name: string, detail: unknown): void => {
  document.dispatchEvent(new CustomEvent(name, { detail: JSON.stringify(detail) }))
}

/**
 * Панель заметок и её связь с картой.
 *
 * Контент-скрипт держит iframe панели, кнопку «Редактировать» и пересылает
 * снимок в MAIN-мир, где живёт ymaps. Сам он карту не трогает.
 */
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    ensureNotesPanelStyles()

    let selectedNoteId: string | null = null
    let drawingKind: DrawableKind | null = null
    let snapshot: NotesSnapshotPayload | null = null
    let editLabel = 'Редактировать'

    const renderSnapshot = (next: NotesSnapshotPayload): void => {
      snapshot = next
      dispatchToPage(NMAPS_RENDER_NOTES_EVENT, snapshotToLayerInput(next))
    }

    const reRenderWithHidden = (hiddenIds: string[]): void => {
      if (!snapshot) return
      renderSnapshot({ ...snapshot, hiddenIds })
    }

    /**
     * Кнопка «Редактировать» есть в разметке только при выбранной заметке.
     *
     * Раньше она лишь пряталась через `display: none`: пустой блок оставался
     * в нижних контролах карты и после закрытия панели выглядел артефактом.
     */
    const syncEditButton = (): void => {
      if (!selectedNoteId) {
        removeNotesEditButton()
        return
      }

      ensureNotesEditButton({
        label: editLabel,
        onClick: () => {
          if (selectedNoteId) host.showNote(selectedNoteId)
        },
      })
    }

    const setSelected = (noteId: string | null): void => {
      selectedNoteId = noteId
      syncEditButton()
    }

    const host = createNotesPanelHost({
      onVisibilityChange: (open) => {
        if (open) {
          syncEditButton()
          return
        }
        // Панель закрыли — выбор и кнопка «Редактировать» больше не нужны.
        setSelected(null)
        dispatchToPage(NMAPS_SELECT_NOTE_EVENT, { noteId: null })
      },
    })

    const refreshLabel = async (): Promise<void> => {
      const locale = await getStoredLocale()
      editLabel = createTranslator(locale)('notesPanel.editButton')
      syncEditButton()
    }

    refreshLabel().catch(() => {})

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (area === 'local' && LOCALE_STORAGE_KEY in changes) {
        refreshLabel().catch(() => {})
      }
    }
    browser.storage.onChanged.addListener(handleStorageChange)

    // Выбор заметки: и от карты, и от панели.
    const handleNoteSelected = (event: Event): void => {
      const detail = (event as CustomEvent).detail as { noteId?: unknown } | undefined
      const noteId = typeof detail?.noteId === 'string' ? detail.noteId : null
      setSelected(noteId)
      browser.runtime.sendMessage({ action: NOTES_SELECT_ACTION, noteId }).catch(() => {})
    }
    document.addEventListener(NMAPS_NOTE_SELECTED_EVENT, handleNoteSelected)

    const handleTogglePanel = (): void => {
      host.toggle()
    }
    document.addEventListener(NMAPS_TOGGLE_NOTES_PANEL_EVENT, handleTogglePanel)

    // Рисование: панель → карта → панель.
    const handlePointPicked = (event: Event): void => {
      if (!drawingKind) return
      const parsed = parsePointPickedEvent(event)
      if (!parsed) return

      const kind = drawingKind
      drawingKind = null
      if (parsed.coords.length === 0) return

      const coords: LonLat[] = parsed.coords.map((coord) => [coord[1], coord[0]])
      browser.runtime
        .sendMessage({ action: NOTES_DRAW_FINISHED_ACTION, kind, coords })
        .catch(() => {})
    }
    document.addEventListener(NMAPS_POINT_PICKED_EVENT, handlePointPicked)

    const startDrawing = (kind: DrawableKind): void => {
      drawingKind = kind
      notifyStartPickPoint(PICKER_GEOM_TYPES[kind])
    }

    const handleRuntimeMessage = (message: Record<string, unknown>): void => {
      switch (message.action) {
        case NOTES_RENDER_ACTION: {
          const payload = message as unknown as NotesSnapshotPayload & {
            action: string
          }
          if (payload.manifest && payload.shards) {
            renderSnapshot({
              manifest: payload.manifest,
              shards: payload.shards,
              hiddenIds: Array.isArray(payload.hiddenIds) ? payload.hiddenIds : [],
              fromCache: false,
            })
          }
          break
        }
        case NOTES_VISIBILITY_ACTION:
        case NOTES_HIDDEN_CHANGED_ACTION: {
          const hiddenIds = Array.isArray(message.hiddenIds)
            ? message.hiddenIds.filter((id): id is string => typeof id === 'string')
            : []
          reRenderWithHidden(hiddenIds)
          break
        }
        case NOTES_SELECT_ACTION: {
          const noteId = typeof message.noteId === 'string' ? message.noteId : null
          dispatchToPage(NMAPS_SELECT_NOTE_EVENT, { noteId })
          setSelected(noteId)
          break
        }
        case NOTES_START_DRAW_ACTION: {
          const kind = message.kind
          if (kind === 'Point' || kind === 'Line' || kind === 'Polygon') {
            startDrawing(kind)
          }
          break
        }
        default:
          break
      }
    }
    browser.runtime.onMessage.addListener(handleRuntimeMessage)

    const handleCancelPick = (): void => {
      if (!drawingKind) return
      drawingKind = null
      notifyCancelPickPoint()
    }
    document.addEventListener(NMAPS_CANCEL_PICK_POINT_EVENT, handleCancelPick)

    browser.runtime
      .sendMessage({ action: NOTES_LOAD_ACTION })
      .then((response: unknown) => {
        const payload = response as { ok?: boolean; snapshot?: NotesSnapshotPayload } | undefined
        if (payload?.ok && payload.snapshot) {
          renderSnapshot(payload.snapshot)
        }
      })
      .catch(() => {})

    const buttonSyncTimer = window.setInterval(() => {
      if (!selectedNoteId) {
        removeNotesEditButton()
        return
      }
      if (document.getElementById(NOTES_EDIT_BUTTON_WRAPPER_ID)) return
      syncEditButton()
    }, BUTTON_SYNC_INTERVAL_MS)

    ctx.onInvalidated(() => {
      window.clearInterval(buttonSyncTimer)
      browser.storage.onChanged.removeListener(handleStorageChange)
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
      document.removeEventListener(NMAPS_NOTE_SELECTED_EVENT, handleNoteSelected)
      document.removeEventListener(NMAPS_TOGGLE_NOTES_PANEL_EVENT, handleTogglePanel)
      document.removeEventListener(NMAPS_POINT_PICKED_EVENT, handlePointPicked)
      document.removeEventListener(NMAPS_CANCEL_PICK_POINT_EVENT, handleCancelPick)
      removeNotesEditButton()
      host.destroy()
    })
  },
})
