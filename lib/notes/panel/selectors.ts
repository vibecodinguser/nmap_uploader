import type { Note, NoteGeometry, NoteGroup } from '../model/types'
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

/**
 * Заметки для списка: поиск по названию и описанию, порядок по имени.
 *
 * Сортировка по-русски захардкожена: заметки создаются с русскими автоименами,
 * и `localeCompare` без локали даёт непредсказуемый порядок на «Ё».
 */
export const selectFilteredNotes = (state: NotesPanelState): Note[] => {
  const needle = state.query.trim().toLowerCase()
  const list = [...selectNotes(state)].sort((left, right) =>
    left.name.localeCompare(right.name, 'ru'),
  )
  if (!needle) return list
  return list.filter(
    (note) =>
      note.name.toLowerCase().includes(needle) || note.description.toLowerCase().includes(needle),
  )
}

export const selectSelectedNote = (state: NotesPanelState): Note | null =>
  selectNotes(state).find((note) => note.id === state.selectedId) ?? null
