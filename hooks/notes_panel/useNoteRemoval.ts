import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { NoteGeometry } from '@/lib/notes/model/types'
import { withNote, withoutNote } from '@/lib/notes/panel/edits'
import { selectGeometries } from '@/lib/notes/panel/selectors'
import type { UndoEntry } from '@/lib/notes/panel/state'
import { NOTES_DELETE_NOTE_ACTION, NOTES_SAVE_NOTE_ACTION } from '@/lib/notes/protocol'
import type { NotesPanelStore } from './useNotesPanelState'
import { type NotesWrites, UNDO_TIMEOUT_MS } from './useNotesWrites'

/**
 * Удаление с возможностью вернуть.
 *
 * Удаление оптимистичное: строка исчезает сразу, а тост даёт пять секунд на
 * отмену. Возврат — это обычное сохранение той же заметки с той же геометрией.
 */
export const useNoteRemoval = (
  { state, dispatch }: NotesPanelStore,
  { enqueueSaveMessage, cancelPending, postPreview }: NotesWrites,
) => {
  const { t } = useLocale()
  const geometries = useMemo(() => selectGeometries(state), [state])
  /** Последнее состояние на момент ответа Диска — см. `useNotesMutations`. */
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  }, [state])

  /**
   * Таймер тоста «Отменить».
   *
   * Один на панель и всегда свой у последнего удаления: иначе таймер первого
   * удаления гасил бы тост второго, и отменить его было бы нельзя.
   */
  const undoTimer = useRef<number | null>(null)

  const clearUndoTimer = useCallback(() => {
    if (undoTimer.current === null) return
    window.clearTimeout(undoTimer.current)
    undoTimer.current = null
  }, [])

  useEffect(() => clearUndoTimer, [clearUndoTimer])

  const showUndo = useCallback(
    (entry: UndoEntry) => {
      clearUndoTimer()
      dispatch({ type: 'undoSet', entry })
      undoTimer.current = window.setTimeout(() => {
        undoTimer.current = null
        dispatch({ type: 'undoCleared' })
      }, UNDO_TIMEOUT_MS)
    },
    [clearUndoTimer, dispatch],
  )

  const removeNote = useCallback(
    (noteId: string) => {
      const note = (state.snapshot?.manifest.notes ?? []).find((item) => item.id === noteId)
      const geometry = geometries[noteId]
      if (!note || !geometry || !state.snapshot) return

      // Удаление должно попасть в очередь после незаписанных правок: иначе
      // отложенное сохранение может вернуть уже удалённую заметку.
      cancelPending(noteId)

      // Оптимистичное удаление: строка исчезает сразу, не дожидаясь Диска.
      // Если запись не пройдёт, заметка вернётся на место с сообщением об ошибке.
      dispatch({ type: 'noteRemoved', noteId })
      postPreview(withoutNote(state.snapshot, noteId))
      showUndo({ note, geometry })

      enqueueSaveMessage(
        { action: NOTES_DELETE_NOTE_ACTION, noteId, date: note.date },
        {
          onSuccess: (response) => {
            // Манифест с Диска — источник истины; локальная копия уже без заметки.
            if (response.ok) dispatch({ type: 'patchApplied', patch: response.patch })
          },
          onError: () => {
            const current = latest.current.snapshot
            if (current) postPreview(withNote(current, note, geometry))
            clearUndoTimer()
            dispatch({ type: 'noteRestored', entry: { note, geometry } })
            dispatch({ type: 'errorChanged', error: t('notesPanel.saveError') })
          },
        },
      )
    },
    [
      cancelPending,
      clearUndoTimer,
      dispatch,
      enqueueSaveMessage,
      geometries,
      postPreview,
      showUndo,
      state.snapshot,
      t,
    ],
  )

  const undoRemove = useCallback(() => {
    const undo = state.undo
    if (!undo || !state.snapshot) return
    const { note, geometry }: { note: typeof undo.note; geometry: NoteGeometry } = undo

    clearUndoTimer()
    dispatch({ type: 'noteRestored', entry: undo })
    postPreview(withNote(state.snapshot, note, geometry))

    enqueueSaveMessage(
      { action: NOTES_SAVE_NOTE_ACTION, note, geometry },
      {
        onSuccess: (response) => {
          if (response.ok) dispatch({ type: 'patchApplied', patch: response.patch })
        },
        onError: () => {
          const current = latest.current.snapshot
          if (current) postPreview(withoutNote(current, note.id))
          dispatch({ type: 'noteRemoved', noteId: note.id })
          dispatch({ type: 'errorChanged', error: t('notesPanel.saveError') })
        },
      },
    )
  }, [clearUndoTimer, dispatch, enqueueSaveMessage, postPreview, state.snapshot, state.undo, t])

  return { removeNote, undoRemove }
}
