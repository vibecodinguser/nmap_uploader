import { useCallback } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { buildAutoGroupName } from '@/lib/notes/model/autonames'
import { NOTE_PALETTE } from '@/lib/notes/model/palette'
import type { NoteGroup } from '@/lib/notes/model/types'
import { withoutGroup } from '@/lib/notes/panel/edits'
import type { GroupDeleteMode } from '@/lib/notes/panel/state'
import {
  NOTES_DELETE_GROUP_ACTION,
  NOTES_MOVE_NOTE_ACTION,
  NOTES_SAVE_GROUP_ACTION,
} from '@/lib/notes/protocol'
import type { NotesPanelStore } from './useNotesPanelState'
import type { NotesWrites } from './useNotesWrites'

/**
 * Группы заметок.
 *
 * Создание и переименование — один и тот же запрос: различает их только
 * наличие группы с таким id. Ошибка группы возвращает список с Диска: после
 * неудачного сохранения локальная копия уже ничего не значит.
 */
export const useNoteGroups = (
  { state, dispatch }: NotesPanelStore,
  { enqueueSaveMessage, postPreview }: NotesWrites,
  reload: () => void,
) => {
  const { t } = useLocale()

  const saveGroup = useCallback(
    (group: NoteGroup) => {
      if (state.snapshot) dispatch({ type: 'groupSaved', group })

      enqueueSaveMessage(
        { action: NOTES_SAVE_GROUP_ACTION, group },
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
    [dispatch, enqueueSaveMessage, reload, state.snapshot, t],
  )

  /**
   * Создать группу.
   *
   * Имя приходит подписью из интерфейса («Новая группа»), а номер добавляется
   * здесь: две группы с одинаковым названием в списке не отличить друг от
   * друга. Расчёт в самой функции, а не у вызывающего, — иначе следующая точка
   * вызова снова создала бы дубль.
   */
  const createGroup = useCallback(
    (baseName: string): NoteGroup => {
      const timestamp = new Date().toISOString()
      const groups = state.snapshot?.manifest.groups ?? []
      const order = groups.reduce((max, group) => Math.max(max, group.order), -1)
      const group: NoteGroup = {
        id: crypto.randomUUID(),
        name: buildAutoGroupName({
          baseName,
          existingNames: groups.map((item) => item.name),
        }),
        // Цвет по кругу палитры: соседние группы не должны сливаться.
        color: NOTE_PALETTE[groups.length % NOTE_PALETTE.length],
        order: order + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      saveGroup(group)
      return group
    },
    [saveGroup, state.snapshot?.manifest.groups],
  )

  const renameGroup = useCallback(
    (groupId: string, name: string) => {
      const group = (state.snapshot?.manifest.groups ?? []).find((item) => item.id === groupId)
      if (!group) return
      saveGroup({ ...group, name: name.trim(), updatedAt: new Date().toISOString() })
    },
    [saveGroup, state.snapshot?.manifest.groups],
  )

  const recolorGroup = useCallback(
    (groupId: string, color: string) => {
      const group = (state.snapshot?.manifest.groups ?? []).find((item) => item.id === groupId)
      if (!group) return
      saveGroup({ ...group, color, updatedAt: new Date().toISOString() })
    },
    [saveGroup, state.snapshot?.manifest.groups],
  )

  /**
   * Удалить группу.
   *
   * `keepNotes` распускает её: заметки остаются на карте и уходят в корень.
   * `cascade` удаляет и заметки — это выбор пользователя в диалоге.
   */
  const removeGroup = useCallback(
    (groupId: string, mode: GroupDeleteMode) => {
      if (state.snapshot) {
        dispatch({ type: 'groupRemoved', groupId, mode })
        postPreview(withoutGroup(state.snapshot, groupId, mode))
      }

      enqueueSaveMessage(
        { action: NOTES_DELETE_GROUP_ACTION, groupId, mode },
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
    [dispatch, enqueueSaveMessage, postPreview, reload, state.snapshot, t],
  )

  /** Перенести заметку в группу или в корень. */
  const moveNoteToGroup = useCallback(
    (noteId: string, groupId: string | null) => {
      const note = (state.snapshot?.manifest.notes ?? []).find((item) => item.id === noteId)
      if (!note) return

      dispatch({
        type: 'noteMoved',
        noteId,
        groupId,
        updatedAt: new Date().toISOString(),
      })

      enqueueSaveMessage(
        { action: NOTES_MOVE_NOTE_ACTION, noteId, groupId },
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
    [dispatch, enqueueSaveMessage, reload, state.snapshot?.manifest.notes, t],
  )

  return { createGroup, renameGroup, recolorGroup, removeGroup, moveNoteToGroup }
}
