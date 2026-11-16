import type { Note, NoteGroup, NoteTombstone } from '../types'

/**
 * Схема манифеста заметок.
 *
 * Манифест — единственный файл, который читает панель: названия, описания,
 * оформление и принадлежность группам. Геометрии в нём нет, она в шардах.
 *
 * Надгробия появились во второй версии: без них удаление, сделанное на одном
 * устройстве, при слиянии возвращалось из копии другого. Файл первой версии
 * читается как есть — отсутствующее поле означает «ничего не удаляли».
 */
export const NOTES_MANIFEST_VERSION = 2

export type NotesManifest = {
  version: number
  updatedAt: string
  groups: NoteGroup[]
  notes: Note[]
  /** Удалённые заметки: нужны, чтобы удаление доехало до других устройств. */
  deletedNotes: NoteTombstone[]
}

export const createEmptyManifest = (): NotesManifest => ({
  version: NOTES_MANIFEST_VERSION,
  updatedAt: new Date(0).toISOString(),
  groups: [],
  notes: [],
  deletedNotes: [],
})
