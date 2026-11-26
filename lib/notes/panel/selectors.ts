import { sortGroups } from '../model/grouping'
import type { Note, NoteGeometry, NoteGroup } from '../model/types'
import { filterNotes, hasActiveFilters } from './filters'
import type { NotesPanelState } from './state'

/**
 * Селекторы панели.
 *
 * Чистые функции над состоянием: что показать в списке, что в свойствах, где
 * геометрия. Компоненты не знают, как устроен снимок.
 */

export const selectNotes = (state: NotesPanelState): Note[] => state.snapshot?.manifest.notes ?? []

/**
 * Группы в порядке показа.
 *
 * Порядок массива в манифесте произвольный: он складывается из истории создания
 * и слияний между устройствами, а `order` у групп из разных устройств может
 * совпадать. Поэтому сортировка здесь одна на всех — список, фильтры и обе
 * формы выбора группы читают одно и то же. Иначе дропдаун фильтра показывал бы
 * группы в одном порядке, а список в другом, и выбор «третьей сверху» уходил бы
 * не в ту группу.
 */
export const selectGroups = (state: NotesPanelState): NoteGroup[] =>
  sortGroups(state.snapshot?.manifest.groups ?? [])

export const selectHiddenIds = (state: NotesPanelState): string[] => state.snapshot?.hiddenIds ?? []

/** Геометрия всех заметок одним словарём: панель не знает про шарды. */
export const selectGeometries = (state: NotesPanelState): Record<string, NoteGeometry> => {
  const geometries: Record<string, NoteGeometry> = {}
  for (const shard of Object.values(state.snapshot?.shards ?? {})) {
    Object.assign(geometries, shard.notes)
  }
  return geometries
}

export const selectGeometry = (
  geometries: Record<string, NoteGeometry>,
  noteId: string,
): NoteGeometry | null => geometries[noteId] ?? null

/** Заметки для списка: поиск, фильтры по виду/группе/видимости и сортировка. */
export const selectFilteredNotes = (state: NotesPanelState): Note[] =>
  filterNotes({
    notes: selectNotes(state),
    groups: selectGroups(state),
    hiddenIds: selectHiddenIds(state),
    query: state.query,
    filter: state.filters,
  })

/** Есть ли чем сузить список: по этому отличают «пусто» от «ничего не найдено». */
export const selectHasNarrowing = (state: NotesPanelState): boolean =>
  state.query.trim() !== '' || hasActiveFilters(state.filters)

export const selectSelectedNote = (state: NotesPanelState): Note | null =>
  selectNotes(state).find((note) => note.id === state.selectedId) ?? null
