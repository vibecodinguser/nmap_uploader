import { sortGroups } from '../model/grouping'
import type { Note, NoteGroup } from '../model/types'

/**
 * Раскладка списка заметок.
 *
 * Модуль чистый и живёт рядом с панелью, а не с моделью: строки списка,
 * высоты и окно прокрутки нужны только интерфейсу. Правила группировки
 * (порядок групп, видимость) остались в модели.
 */

export type GroupHeaderRow = {
  type: 'group'
  /** id группы или `null` для заголовка «Без группы». */
  groupId: string | null
  title: string
  color: string | null
  notesCount: number
  collapsed: boolean
  /** id заметок группы: по ним считается видимость и переключается вся группа. */
  noteIds: string[]
}

export type NoteRow = {
  type: 'note'
  note: Note
}

export type NoteListRow = GroupHeaderRow | NoteRow

/**
 * Высоты строк списка.
 *
 * Совпадают с CSS один в один: список виртуализирован, и раскладка считает
 * смещения по этим числам, а не по реальной высоте узлов. Расхождение дало бы
 * «прыгающую» прокрутку. Размеры рассчитаны на палец: 64 px — комфортная цель
 * нажатия для строки с тремя действиями.
 */
export const GROUP_HEADER_HEIGHT = 48
export const NOTE_ROW_HEIGHT = 64

/**
 * Ключ свёрнутости.
 *
 * У корня нет id, поэтому он получает пустую строку — один и тот же ключ
 * нужен и при сборке списка, и при переключении заголовка в интерфейсе.
 */
export const collapseKey = (groupId: string | null): string => groupId ?? ''

/**
 * Оставить только ключи существующих групп.
 *
 * Свёрнутость живёт в `storage.local` и переживает удаление групп, поэтому при
 * записи список чистится: иначе после роспуска десятка групп в настройках
 * оставались бы их id навсегда. Ключ корня (`''`) сохраняется всегда — он не
 * привязан к группе.
 */
export const pruneCollapsedKeys = (
  keys: readonly string[],
  groupIds: readonly string[],
): string[] => {
  const alive = new Set(groupIds)
  const kept = keys.filter((key) => key === collapseKey(null) || alive.has(key))
  return [...new Set(kept)]
}

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
      noteIds: groupNotes.map((note) => note.id),
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
      noteIds: ungroupedNotes.map((note) => note.id),
    })
  }

  if (ordered.length === 0 || !collapsed.has(collapseKey(null))) {
    for (const note of ungroupedNotes) rows.push({ type: 'note', note })
  }

  return rows
}

/** Высота строки: заголовки ниже строк заметки. */
const rowHeight = (row: NoteListRow): number =>
  row.type === 'group' ? GROUP_HEADER_HEIGHT : NOTE_ROW_HEIGHT

type PositionedRow = { row: NoteListRow; top: number; height: number }

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
