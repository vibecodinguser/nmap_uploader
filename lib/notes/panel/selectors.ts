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

export const selectGroups = (state: NotesPanelState): NoteGroup[] =>
  state.snapshot?.manifest.groups ?? []

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

/** Сколько заметок скрыто фильтрами и поиском — для подписи под панелью. */
export const selectHiddenByFilters = (state: NotesPanelState): number =>
  selectNotes(state).length - selectFilteredNotes(state).length

export const selectSelectedNote = (state: NotesPanelState): Note | null =>
  selectNotes(state).find((note) => note.id === state.selectedId) ?? null
