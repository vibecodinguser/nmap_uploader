import { useCallback, useEffect, useRef } from 'react'
import { browser } from 'wxt/browser'
import { useLocale } from '@/hooks/useLocale'
import type { Note, NoteGeometry } from '@/lib/notes/model/types'
import type { NotesSnapshot } from '@/lib/notes/protocol'
import { NOTES_SAVE_NOTE_ACTION, type NotesMutationResponse } from '@/lib/notes/protocol'
import { NOTES_PANEL_PREVIEW_MESSAGE } from '@/lib/notes_panel/host'
import type { NotesPanelStore } from './useNotesPanelState'

const SAVE_DEBOUNCE_MS = 700
export const UNDO_TIMEOUT_MS = 5000

/**
 * Запись заметок: очередь, дебаунс и мгновенный отклик карты.
 *
 * Здесь только транспорт записи и отложенная правка. Что именно меняется в
 * снимке, решает редьюсер — этот хук лишь сообщает результат.
 */
export const useNotesWrites = ({ dispatch }: NotesPanelStore) => {
  const { t } = useLocale()
  const saveTimer = useRef<number | null>(null)
  const pendingNote = useRef<{ note: Note; geometry: NoteGeometry } | null>(null)
  /**
   * Цепочка отправок.
   *
   * Дебаунс ограничивает частоту, но не запрещает вторую отправку, пока первая
   * ещё в пути. Две параллельные записи одного файла дают от Диска
   * `423 LOCKED`, поэтому запросы идут строго по одному.
   */
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())

  /**
   * Показать состояние карте немедленно.
   *
   * Панель — iframe страницы карты, поэтому снимок можно отдать напрямую в
   * хост, не дожидаясь, пока background запишет файлы на Диск.
   */
  const postPreview = useCallback((next: NotesSnapshot) => {
    try {
      window.parent?.postMessage({ action: NOTES_PANEL_PREVIEW_MESSAGE, snapshot: next }, '*')
    } catch {
      // Кросс-доменный родитель — карта просто догонит широковещательным снимком.
    }
  }, [])

  const enqueueSaveMessage = useCallback(
    (
      message: Record<string, unknown>,
      handlers: {
        onSuccess: (response: NotesMutationResponse) => void
        onError: () => void
      },
    ) => {
      saveChain.current = saveChain.current
        .then(() => browser.runtime.sendMessage(message))
        .then((response: unknown) => {
          const parsed = response as NotesMutationResponse | undefined
          // `ok: false` и пустой ответ — тоже неудача: background вернул её
          // вместо исключения, и вызывающий код должен откатить состояние.
          if (!parsed?.ok) {
            handlers.onError()
            return
          }
          handlers.onSuccess(parsed)
        })
        .catch(() => handlers.onError())
    },
    [],
  )

  const flushSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const pending = pendingNote.current
    if (!pending) return
    pendingNote.current = null

    enqueueSaveMessage(
      { action: NOTES_SAVE_NOTE_ACTION, note: pending.note, geometry: pending.geometry },
      {
        onSuccess: (response) => {
          if (!response.ok) {
            dispatch({ type: 'errorChanged', error: response.error })
            return
          }
          dispatch({ type: 'patchApplied', patch: response.patch })
          dispatch({ type: 'errorChanged', error: null })
        },
        onError: () => dispatch({ type: 'errorChanged', error: t('notesPanel.saveError') }),
      },
    )
  }, [dispatch, enqueueSaveMessage, t])

  const scheduleSave = useCallback(
    (note: Note, geometry: NoteGeometry) => {
      pendingNote.current = { note, geometry }
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS)
    },
    [flushSave],
  )

  /**
   * Отменяет отложенную правку.
   *
   * `noteId` ограничивает отмену одной заметкой: удаление не должно выбрасывать
   * правку другой. Без аргумента отменяет всё — так делает сброс при закрытии.
   */
  const cancelPending = useCallback((noteId?: string) => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (noteId === undefined || pendingNote.current?.note.id === noteId) {
      pendingNote.current = null
    }
  }, [])

  // Незаписанная правка не должна потеряться при закрытии панели.
  useEffect(() => () => flushSave(), [flushSave])

  return { enqueueSaveMessage, scheduleSave, flushSave, cancelPending, postPreview }
}

export type NotesWrites = ReturnType<typeof useNotesWrites>
