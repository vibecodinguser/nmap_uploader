import { useCallback, useMemo } from 'react'
import { browser } from 'wxt/browser'
import { geometryAnchor, geometryBounds, zoomForBounds } from '@/lib/notes/model/geometry'
import { type GroupVisibility, groupVisibility } from '@/lib/notes/model/grouping'
import type { NoteGeometry } from '@/lib/notes/model/types'
import { setNotesHidden, toggleHiddenNoteId } from '@/lib/notes/model/visibility'
import { DEFAULT_NOTES_FILTER, type NotesFilter } from '@/lib/notes/panel/filters'
import { collapseKey } from '@/lib/notes/panel/rows'
import {
  selectFilteredNotes,
  selectGeometries,
  selectGeometry,
  selectGroups,
  selectHasNarrowing,
  selectHiddenIds,
  selectSelectedNote,
} from '@/lib/notes/panel/selectors'
import { NOTES_HIDDEN_CHANGED_ACTION, NOTES_SELECT_ACTION } from '@/lib/notes/protocol'
import type { NotesPanelStore } from './useNotesPanelState'

/**
 * Что панель показывает и как навигация влияет на карту.
 *
 * Список, поиск, свёрнутость групп, скрытие и «найти на карте». Никаких
 * изменений данных здесь нет: только вид и навигация.
 */
export const useNotesView = ({ state, dispatch }: NotesPanelStore) => {
  const notes = useMemo(() => selectFilteredNotes(state), [state])
  const groups = selectGroups(state)
  const hiddenIds = selectHiddenIds(state)
  const selectedNote = selectSelectedNote(state)
  const geometries = useMemo(() => selectGeometries(state), [state])

  const geometryOf = useCallback(
    (noteId: string): NoteGeometry | null => selectGeometry(geometries, noteId),
    [geometries],
  )

  const selectNote = useCallback(
    (noteId: string | null) => {
      dispatch({ type: 'noteSelected', noteId })
      browser.runtime.sendMessage({ action: NOTES_SELECT_ACTION, noteId }).catch(() => {})
    },
    [dispatch],
  )

  /**
   * Показать заметку на карте.
   *
   * Это навигация, а не редактирование: карта центрируется на объекте, но
   * выбранная заметка не меняется и свойства не открываются.
   */
  const locateNote = useCallback(
    (noteId: string) => {
      const geometry = geometryOf(noteId)
      if (!geometry) return
      const anchor = geometryAnchor(geometry)
      const bounds = geometryBounds(geometry)
      if (!anchor) return

      browser.runtime
        .sendMessage({
          action: 'centerMap',
          latitude: anchor[1],
          longitude: anchor[0],
          zoom: bounds ? Math.max(zoomForBounds(bounds), 15) : 17,
        })
        .catch(() => {})
    },
    [geometryOf],
  )

  /** Применить новый набор скрытых: состояние и карта обновляются одним сообщением. */
  const commitHiddenIds = useCallback(
    (next: string[]) => {
      dispatch({ type: 'hiddenChanged', hiddenIds: next })
      browser.runtime
        .sendMessage({ action: NOTES_HIDDEN_CHANGED_ACTION, hiddenIds: next })
        .catch(() => {})
    },
    [dispatch],
  )

  const toggleHidden = useCallback(
    (noteId: string) => commitHiddenIds(toggleHiddenNoteId(hiddenIds, noteId)),
    [commitHiddenIds, hiddenIds],
  )

  /**
   * Переключить видимость группы.
   *
   * Правило как у чекбокса «выбрать всё»: если видно хотя бы что-то, скрываем
   * всю группу, иначе показываем всю. Иначе при частично скрытой группе первый
   * клик оставлял бы половину объектов на карте.
   */
  const toggleGroupHidden = useCallback(
    (noteIds: readonly string[], visibility: GroupVisibility) => {
      commitHiddenIds(setNotesHidden(hiddenIds, noteIds, visibility !== 'hidden'))
    },
    [commitHiddenIds, hiddenIds],
  )

  const toggleGroupCollapsed = useCallback(
    (groupId: string | null) => {
      dispatch({ type: 'groupCollapsedToggled', key: collapseKey(groupId) })
    },
    [dispatch],
  )

  return {
    notes,
    groups,
    hiddenIds,
    selectedNote,
    selectedId: state.selectedId,
    query: state.query,
    filters: state.filters,
    /** Есть ли поиск или фильтры: по этому отличают «пусто» от «не найдено». */
    hasNarrowing: selectHasNarrowing(state),
    mode: state.mode,
    collapsedGroupIds: state.collapsedGroupIds,
    geometryOf,
    selectNote,
    locateNote,
    toggleHidden,
    toggleGroupHidden,
    toggleGroupCollapsed,
    groupVisibility,
    setQuery: (query: string) => dispatch({ type: 'queryChanged', query }),
    setFilters: (filters: Partial<NotesFilter>) => dispatch({ type: 'filtersChanged', filters }),
    resetFilters: () => dispatch({ type: 'filtersChanged', filters: DEFAULT_NOTES_FILTER }),
    setMode: (mode: typeof state.mode) => dispatch({ type: 'modeChanged', mode }),
  }
}

export type NotesView = ReturnType<typeof useNotesView>
