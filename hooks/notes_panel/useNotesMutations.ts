import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { formatDateDisplay } from '@/lib/date_format'
import { buildAutoNoteName } from '@/lib/notes/model/autonames'
import { createDefaultStyle } from '@/lib/notes/model/style_resolution'
import type { Note, NoteGeometry } from '@/lib/notes/model/types'
import { replaceNote, withNote, withoutNote } from '@/lib/notes/panel/edits'
import { EMPTY_NOTES_SNAPSHOT } from '@/lib/notes/panel/empty'
import { kindLabelKey } from '@/lib/notes/panel/labels'
import { selectGeometries } from '@/lib/notes/panel/selectors'
import { type DrawableNoteKind, NOTES_SAVE_NOTE_ACTION } from '@/lib/notes/protocol'
import type { NotesPanelStore } from './useNotesPanelState'
import type { NotesWrites } from './useNotesWrites'

/**
 * Создание, правка и удаление заметки.
 *
 * Все изменения сначала попадают в состояние панели и на карту, а на Диск
 * уезжают очередью. Ответ Диска накладывается патчем; если запись не прошла,
 * интерфейс возвращается к тому, что действительно лежит в хранилище.
 */
export const useNotesMutations = (
  { state, dispatch }: NotesPanelStore,
  { enqueueSaveMessage, scheduleSave, postPreview }: NotesWrites,
) => {
  const { t } = useLocale()
  const geometries = useMemo(() => selectGeometries(state), [state])
  /**
   * Последнее состояние на момент ответа Диска.
   *
   * Ошибка записи приходит через секунды после вызова, и снимок из замыкания к
   * этому времени устаревает: откат по нему унёс бы и то, что пользователь
   * успел создать или изменить за это время.
   */
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  }, [state])

  const createNote = useCallback(
    (kind: DrawableNoteKind, geometry: NoteGeometry) => {
      const date = formatDateDisplay(new Date())
      const existingNames = (state.snapshot?.manifest.notes ?? []).map((note) => note.name)
      const name = buildAutoNoteName({
        date,
        kindLabel: t(kindLabelKey(kind)),
        existingNames,
      })

      const timestamp = new Date().toISOString()
      const note: Note = {
        id: crypto.randomUUID(),
        kind,
        name,
        description: '',
        date,
        icon: null,
        showLabel: false,
        style: createDefaultStyle(kind),
        groupId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      // Оптимистичное создание: заметка появляется на карте и в списке сразу,
      // не дожидаясь Диска. Полный цикл записи — несколько сетевых round-trip,
      // и держать пользователя в ожидании после каждого клика по карте незачем.
      const optimistic = withNote(state.snapshot ?? EMPTY_NOTES_SNAPSHOT, note, geometry)
      dispatch({ type: 'noteAdded', note, geometry })
      postPreview(optimistic)

      enqueueSaveMessage(
        { action: NOTES_SAVE_NOTE_ACTION, note, geometry },
        {
          onSuccess: (response) => {
            if (response.ok) dispatch({ type: 'patchApplied', patch: response.patch })
          },
          onError: () => {
            // Не записалось — убираем заметку с карты и из списка, чтобы не
            // осталось призрака, которого нет на других устройствах.
            const current = latest.current.snapshot
            if (current) postPreview(withoutNote(current, note.id))
            dispatch({ type: 'noteRemoved', noteId: note.id })
            dispatch({ type: 'errorChanged', error: t('notesPanel.createFailed') })
          },
        },
      )
    },
    [dispatch, enqueueSaveMessage, postPreview, state.snapshot, t],
  )

  const updateNote = useCallback(
    (noteId: string, patch: Partial<Note>) => {
      const note = (state.snapshot?.manifest.notes ?? []).find((item) => item.id === noteId)
      const geometry = geometries[noteId]
      if (!note || !geometry || !state.snapshot) return

      const next: Note = { ...note, ...patch, updatedAt: new Date().toISOString() }

      // Правка видна на карте сразу: цвет, подпись и название не должны
      // ждать записи на Диск.
      dispatch({ type: 'notePatched', note: next })
      postPreview(replaceNote(state.snapshot, next))
      scheduleSave(next, geometry)
    },
    [dispatch, geometries, postPreview, scheduleSave, state.snapshot],
  )

  return { createNote, updateNote }
}
