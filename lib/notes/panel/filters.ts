import { displayToIso } from '@/lib/date_format'
import type { Note, NoteGroup, NoteKind } from '../model/types'

/**
 * Фильтры и сортировка списка заметок.
 *
 * Чистые функции: панель и тесты говорят о них на одном языке, а правило
 * «что считать видимым» живёт в одном месте, а не размазано по компонентам.
 * Фильтр по видимости учитывает только локальное скрытие: на Диске его нет.
 */

/** «Все группы» и «без группы» — не id группы, поэтому это отдельные значения. */
export const GROUP_FILTER_ALL = 'all'
export const GROUP_FILTER_NONE = 'none'

export type GroupFilter = typeof GROUP_FILTER_ALL | typeof GROUP_FILTER_NONE | string

export type VisibilityFilter = 'all' | 'visible' | 'hidden'

export type NoteSort = 'name' | 'nameDesc' | 'date' | 'dateDesc'

export type NotesFilter = {
  /** Пустой список — все виды: так «снять все галочки» значит «не фильтровать». */
  kinds: NoteKind[]
  /** `all`, `none` или id группы. */
  group: GroupFilter
  visibility: VisibilityFilter
  sort: NoteSort
}

export const DEFAULT_NOTES_FILTER: NotesFilter = {
  kinds: [],
  group: GROUP_FILTER_ALL,
  visibility: 'all',
  sort: 'name',
}

/** Включён ли хоть один фильтр: по нему отличается «пусто» и «ничего не найдено». */
export const hasActiveFilters = (filter: NotesFilter): boolean =>
  filter.kinds.length > 0 || filter.group !== GROUP_FILTER_ALL || filter.visibility !== 'all'

/** Переключение вида в наборе: пустой набор означает «все виды». */
export const toggleKind = (kinds: readonly NoteKind[], kind: NoteKind): NoteKind[] =>
  kinds.includes(kind) ? kinds.filter((item) => item !== kind) : [...kinds, kind]

const matchesQuery = (note: Note, needle: string): boolean =>
  needle === '' ||
  note.name.toLowerCase().includes(needle) ||
  note.description.toLowerCase().includes(needle)

const matchesGroup = (
  note: Note,
  group: GroupFilter,
  knownGroupIds: ReadonlySet<string>,
): boolean => {
  if (group === GROUP_FILTER_ALL) return true
  // Заметка с ссылкой на удалённую группу показывается в корне — значит и в
  // фильтре «без группы» она тоже должна быть.
  if (group === GROUP_FILTER_NONE) {
    return note.groupId === null || !knownGroupIds.has(note.groupId)
  }
  return note.groupId === group
}

const matchesVisibility = (
  note: Note,
  visibility: VisibilityFilter,
  hiddenIds: ReadonlySet<string>,
): boolean => {
  if (visibility === 'all') return true
  if (visibility === 'hidden') return hiddenIds.has(note.id)
  return !hiddenIds.has(note.id)
}

const timestampOf = (note: Note): string => displayToIso(note.date) ?? ''

/**
 * Сортировка.
 *
 * По названию — по-русски: заметки создаются с русскими автоименами, и
 * `localeCompare` без локали даёт непредсказуемый порядок на «Ё». По дате —
 * по календарю, а не по строке: `14-11-2026` и `01-12-2026` строкой
 * сравнились бы неверно.
 */
const compareNotes =
  (sort: NoteSort) =>
  (left: Note, right: Note): number => {
    if (sort === 'date' || sort === 'dateDesc') {
      const result = timestampOf(left).localeCompare(timestampOf(right))
      const ordered = sort === 'date' ? result : -result
      if (ordered !== 0) return ordered
    }

    const byName = left.name.localeCompare(right.name, 'ru')
    return sort === 'nameDesc' ? -byName : byName
  }

/** Применяет поиск, фильтры и сортировку. Порядок фильтров не влияет на результат. */
export const filterNotes = ({
  notes,
  groups,
  hiddenIds,
  query,
  filter,
}: {
  notes: readonly Note[]
  groups: readonly NoteGroup[]
  hiddenIds: readonly string[]
  query: string
  filter: NotesFilter
}): Note[] => {
  const needle = query.trim().toLowerCase()
  const hidden = new Set(hiddenIds)
  const knownGroupIds = new Set(groups.map((group) => group.id))
  const kinds = new Set(filter.kinds)

  return notes
    .filter((note) => matchesQuery(note, needle))
    .filter((note) => kinds.size === 0 || kinds.has(note.kind))
    .filter((note) => matchesGroup(note, filter.group, knownGroupIds))
    .filter((note) => matchesVisibility(note, filter.visibility, hidden))
    .sort(compareNotes(filter.sort))
}
