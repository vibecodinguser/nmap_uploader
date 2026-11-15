import type { Note, NoteGroup } from './types'

/**
 * Группировка заметок в списке.
 *
 * Один уровень вложенности: группа — это именованный набор заметок, заметка
 * состоит не более чем в одной группе. Подгрупп нет намеренно: при тысячах
 * объектов дерево становится неуправляемым, а нужен только цвет и порядок.
 *
 * Модуль чистый: возвращает раскладку списка, которую рендерят компоненты.
 * Так правила группировки тестируются без DOM.
 */

export type GroupHeaderRow = {
  type: 'group'
  /** id группы или `null` для заголовка «Без группы». */
  groupId: string | null
  title: string
  color: string | null
  notesCount: number
  collapsed: boolean
}

export type NoteRow = {
  type: 'note'
  note: Note
}

export type NoteListRow = GroupHeaderRow | NoteRow

export const GROUP_HEADER_HEIGHT = 40
export const NOTE_ROW_HEIGHT = 56

/** Заголовок «Без группы» нужен только когда группы вообще есть. */
export const UNGROUPED_TITLE_KEY = 'notesPanel.noGroup'

/**
 * Ключ свёрнутости.
 *
 * У корня нет id, поэтому он получает пустую строку — один и тот же ключ
 * нужен и при сборке списка, и при переключении заголовка в интерфейсе.
 */
export const collapseKey = (groupId: string | null): string => groupId ?? ''

/** Заголовок «Без группы» всегда последний: корень идёт после групп. */
export const isUngroupedHeader = (row: GroupHeaderRow): boolean => row.groupId === null

/**
 * Порядок групп: `order`, затем название.
 *
 * `order` может совпадать у групп из разных устройств (обе получили 0), и
 * тогда единственный предсказуемый порядок — по имени.
 */
export const sortGroups = (groups: readonly NoteGroup[]): NoteGroup[] =>
  [...groups].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order
    return left.name.localeCompare(right.name, 'ru')
  })

/**
 * Раскладка списка: заголовки групп и заметки под ними.
 *
 * Решение о показе заголовка «Без группы» зависит от того, есть ли группы:
 * пока их нет, список остаётся плоским и лишний заголовок не мешает.
 */
export const buildListRows = ({
  notes,
  groups,
  collapsedGroupIds,
  ungroupedTitle,
}: {
  notes: readonly Note[]
  groups: readonly NoteGroup[]
  collapsedGroupIds: readonly string[]
  ungroupedTitle: string
}): NoteListRow[] => {
  const collapsed = new Set(collapsedGroupIds)
  const ordered = sortGroups(groups)
  const knownGroupIds = new Set(ordered.map((group) => group.id))
  const rows: NoteListRow[] = []

  for (const group of ordered) {
    const groupNotes = notes.filter((note) => note.groupId === group.id)
    rows.push({
      type: 'group',
      groupId: group.id,
      title: group.name,
      color: group.color,
      notesCount: groupNotes.length,
      collapsed: collapsed.has(group.id),
    })
    if (!collapsed.has(group.id)) {
      for (const note of groupNotes) rows.push({ type: 'note', note })
    }
  }

  // Заметки с ссылкой на удалённую группу тоже попадают в корень: иначе они
  // исчезли бы из списка, оставшись на карте.
  const ungroupedNotes = notes.filter(
    (note) => note.groupId === null || !knownGroupIds.has(note.groupId),
  )

  if (ordered.length > 0) {
    rows.push({
      type: 'group',
      groupId: null,
      title: ungroupedTitle,
      color: null,
      notesCount: ungroupedNotes.length,
      collapsed: collapsed.has(collapseKey(null)),
    })
  }

  if (ordered.length === 0 || !collapsed.has(collapseKey(null))) {
    for (const note of ungroupedNotes) rows.push({ type: 'note', note })
  }

  return rows
}

/** Высота строки: заголовки ниже строк заметки. */
export const rowHeight = (row: NoteListRow): number =>
  row.type === 'group' ? GROUP_HEADER_HEIGHT : NOTE_ROW_HEIGHT

export type PositionedRow = { row: NoteListRow; top: number; height: number }

/** Раскладка с вертикальными смещениями — вход для виртуализации. */
export const positionRows = (rows: readonly NoteListRow[]): PositionedRow[] => {
  let top = 0
  return rows.map((row) => {
    const height = rowHeight(row)
    const positioned = { row, top, height }
    top += height
    return positioned
  })
}

/** Общая высота списка — по ней задаётся прокручиваемый блок. */
export const totalHeight = (rows: readonly NoteListRow[]): number =>
  rows.reduce((sum, row) => sum + rowHeight(row), 0)

/**
 * Видимый срез списка для окна прокрутки.
 *
 * Ищет первое смещение, попадающее в окно, а не перебирает все строки:
 * прокрутка срабатывает на каждый кадр, и линейный проход по тысячам строк
 * был бы заметен.
 */
export const visibleSlice = (
  rows: readonly PositionedRow[],
  scrollTop: number,
  viewportHeight: number,
  overscan = 6,
): { items: PositionedRow[]; startIndex: number } => {
  const min = Math.max(0, scrollTop - overscan * NOTE_ROW_HEIGHT)
  const max = scrollTop + viewportHeight + overscan * NOTE_ROW_HEIGHT

  let low = 0
  let high = rows.length - 1
  let startIndex = 0

  while (low <= high) {
    const middle = (low + high) >> 1
    const row = rows[middle]
    if (row.top + row.height <= min) {
      low = middle + 1
    } else {
      startIndex = middle
      high = middle - 1
    }
  }

  const items: PositionedRow[] = []
  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index]
    if (row.top >= max) break
    items.push(row)
  }

  return { items, startIndex }
}

/** Сколько заметок в каждой группе — для подписи в заголовке. */
export const countNotesByGroup = (notes: readonly Note[]): Record<string, number> =>
  notes.reduce<Record<string, number>>((counts, note) => {
    const key = note.groupId ?? ''
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
