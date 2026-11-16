import { useCallback, useEffect, useRef } from 'react'
import { browser } from 'wxt/browser'
import { useLocale } from '@/hooks/useLocale'
import type { Note, NoteGeometry } from '@/lib/notes/model/types'
import {
  NOTES_SAVE_NOTE_ACTION,
  type NotesMutationResponse,
  type NotesSnapshot,
} from '@/lib/notes/protocol'
import { NOTES_PANEL_PREVIEW_MESSAGE } from '@/lib/notes_panel/host'
import type { NotesPanelStore } from './useNotesPanelState'

const SAVE_DEBOUNCE_MS = 700
export const UNDO_TIMEOUT_MS = 5000

type PendingSave = { note: Note; geometry: NoteGeometry }

/**
 * Запись заметок: очередь, дебаунс и мгновенный отклик карты.
 *
 * Отложенные правки хранятся по id заметки, а не одной ячейкой: пользователь
 * правит несколько заметок подряд, и «последняя правка вытесняет предыдущую»
 * теряла бы изменения молча.
 *
 * Здесь только транспорт записи. Что именно меняется в снимке, решает
 * редьюсер — этот хук лишь сообщает результат.
 */
export const useNotesWrites = ({ dispatch }: NotesPanelStore) => {
  const { t } = useLocale()
  const saveTimer = useRef<number | null>(null)
  const pendingNotes = useRef(new Map<string, PendingSave>())
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
    const batch = [...pendingNotes.current.values()]
    pendingNotes.current.clear()

    for (const { note, geometry } of batch) {
      enqueueSaveMessage(
        { action: NOTES_SAVE_NOTE_ACTION, note, geometry },
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
    }
  }, [dispatch, enqueueSaveMessage, t])

  const scheduleSave = useCallback(
    (note: Note, geometry: NoteGeometry) => {
      // Для одной заметки побеждает последняя правка: более ранняя уже
      // неактуальна и отдельной записи не требует.
      pendingNotes.current.set(note.id, { note, geometry })
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
    if (noteId === undefined) {
      pendingNotes.current.clear()
    } else {
      pendingNotes.current.delete(noteId)
    }

    if (pendingNotes.current.size > 0) return
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
  }, [])

  // Незаписанные правки не должны потеряться при закрытии панели.
  useEffect(() => () => flushSave(), [flushSave])

  return { enqueueSaveMessage, scheduleSave, flushSave, cancelPending, postPreview }
}

export type NotesWrites = ReturnType<typeof useNotesWrites>
