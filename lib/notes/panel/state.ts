import type { Note, NoteGeometry, NoteKind } from '../model/types'
import type { NotesSnapshot } from '../protocol'
import { DEFAULT_NOTES_FILTER, type NotesFilter } from './filters'

/**
 * Состояние панели заметок.
 *
 * Живёт вне React: редьюсер и селекторы — чистые функции, поэтому правила
 * «что происходит с панелью после сохранения» проверяются без монтирования
 * компонентов и без браузерных моков.
 */

export type NotesPanelMode = 'list' | 'properties'
export type NotesPanelStatus = 'loading' | 'ready' | 'auth' | 'error'
export type GroupDeleteMode = 'keepNotes' | 'cascade'

/** Удалённая заметка, которую ещё можно вернуть: тост живёт несколько секунд. */
export type UndoEntry = { note: Note; geometry: NoteGeometry }

export type NotesPanelState = {
  snapshot: NotesSnapshot | null
  status: NotesPanelStatus
  error: string | null
  mode: NotesPanelMode
  selectedId: string | null
  /**
   * Отмеченные заметки для массовых действий.
   *
   * Отдельно от `selectedId`: одна заметка открыта в свойствах, другие могут
   * быть отмечены для удаления или переноса — это разные состояния.
   */
  checkedIds: string[]
  query: string
  /** Виды, группа, видимость и порядок списка. */
  filters: NotesFilter
  drawingKind: NoteKind | null
  undo: UndoEntry | null
  /** Ключи свёрнутых групп: id группы или `''` для корня. */
  collapsedGroupIds: string[]
}

export const initialNotesPanelState: NotesPanelState = {
  snapshot: null,
  status: 'loading',
  error: null,
  mode: 'list',
  selectedId: null,
  checkedIds: [],
  query: '',
  filters: DEFAULT_NOTES_FILTER,
  drawingKind: null,
  undo: null,
  collapsedGroupIds: [],
}
