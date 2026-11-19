import { useCallback, useMemo } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { withNoteGroup, withoutNote } from '@/lib/notes/panel/edits'
import { NOTES_DELETE_NOTES_ACTION, NOTES_MOVE_NOTES_ACTION } from '@/lib/notes/protocol'
import type { NotesPanelStore } from './useNotesPanelState'
import type { NotesWrites } from './useNotesWrites'

/**
 * Массовые действия над отмеченными заметками.
 *
 * Одна операция на всю пачку: сто заметок — одна запись манифеста и по одной
 * на затронутый шард. Цикл одиночных сохранений был бы в сто раз дороже и
 * оставлял бы промежуточные состояния на Диске.
 *
 * Возврат удаления реализован только для одиночной заметки: пачка в тосте не
 * помещается, а «отменить всё» требует помнить геометрию десятков объектов.
 */
export const useNoteSelection = (
  { state, dispatch }: NotesPanelStore,
  { enqueueSaveMessage, postPreview }: NotesWrites,
  reload: () => void,
) => {
  const { t } = useLocale()
  const checkedIds = state.checkedIds

  const checked = useMemo(() => new Set(checkedIds), [checkedIds])

  const toggleChecked = useCallback(
    (noteId: string, isChecked: boolean) => {
      dispatch({ type: 'noteChecked', noteId, checked: isChecked })
    },
    [dispatch],
  )

  const clearChecked = useCallback(() => dispatch({ type: 'checkedCleared' }), [dispatch])

  /** Отметить все видимые: частый случай — «удалить всё, что нашлось фильтром». */
  const checkAllVisible = useCallback(
    (noteIds: readonly string[]) => dispatch({ type: 'checkedReplaced', noteIds: [...noteIds] }),
    [dispatch],
  )

  /**
   * «Отметить все» — переключатель.
   *
   * Если отмечено уже всё видимое, повторное нажатие снимает отметки: кнопка
   * стоит на месте, и второе нажатие читается как «вернуть как было», а не как
   * «ничего не произошло». Проверяется именно видимый набор, а не весь
   * `checkedIds`: под фильтром отмеченными могут быть только его результаты.
   *
   * Снимаются все отметки, а не только видимые: кнопка называется «Отметить
   * все», и обратное действие для неё — пустой выбор.
   */
  const toggleSelectAll = useCallback(
    (noteIds: readonly string[]) => {
      if (noteIds.length === 0) return
      const allChecked = noteIds.every((noteId) => checked.has(noteId))
      dispatch(
        allChecked
          ? { type: 'checkedCleared' }
          : { type: 'checkedReplaced', noteIds: [...noteIds] },
      )
    },
    [checked, dispatch],
  )

  const deleteChecked = useCallback(() => {
    const noteIds = checkedIds
    if (noteIds.length === 0 || !state.snapshot) return

    const optimistic = noteIds.reduce(
      (snapshot, noteId) => withoutNote(snapshot, noteId),
      state.snapshot,
    )
    // Список обновляется сразу: ответ Диска приходит позже, а строки должны
    // исчезнуть в момент нажатия.
    dispatch({ type: 'notesRemoved', noteIds })
    postPreview(optimistic)

    enqueueSaveMessage(
      { action: NOTES_DELETE_NOTES_ACTION, noteIds },
      {
        onSuccess: (response) => {
          if (response.ok) dispatch({ type: 'patchApplied', patch: response.patch })
        },
        onError: () => {
          // Возврат пачки — это полная перезагрузка снимка: локально мы уже
          // потеряли и заметки, и их порядок.
          dispatch({ type: 'errorChanged', error: t('notesPanel.saveError') })
          reload()
        },
      },
    )
  }, [checkedIds, dispatch, enqueueSaveMessage, postPreview, reload, state.snapshot, t])

  const moveCheckedToGroup = useCallback(
    (groupId: string | null) => {
      const noteIds = checkedIds
      if (noteIds.length === 0 || !state.snapshot) return

      const timestamp = new Date().toISOString()
      const optimistic = noteIds.reduce(
        (snapshot, noteId) => withNoteGroup(snapshot, noteId, groupId, timestamp),
        state.snapshot,
      )
      dispatch({ type: 'notesMoved', noteIds, groupId, updatedAt: timestamp })
      postPreview(optimistic)

      enqueueSaveMessage(
        { action: NOTES_MOVE_NOTES_ACTION, noteIds, groupId },
        {
          onSuccess: (response) => {
            if (response.ok) dispatch({ type: 'patchApplied', patch: response.patch })
          },
          onError: () => {
            dispatch({ type: 'errorChanged', error: t('notesPanel.saveError') })
            reload()
          },
        },
      )
    },
    [checkedIds, dispatch, enqueueSaveMessage, postPreview, reload, state.snapshot, t],
  )

  return {
    checkedIds,
    isChecked: (noteId: string) => checked.has(noteId),
    toggleChecked,
    clearChecked,
    checkAllVisible,
    toggleSelectAll,
    deleteChecked,
    moveCheckedToGroup,
  }
}

export type NoteSelection = ReturnType<typeof useNoteSelection>
