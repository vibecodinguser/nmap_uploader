import type { Note, NoteGroup } from '../types'

/**
 * Схема манифеста заметок.
 *
 * Манифест — единственный файл, который читает панель: названия, описания,
 * оформление и принадлежность группам. Геометрии в нём нет, она в шардах.
 */
export const NOTES_MANIFEST_VERSION = 1

export type NotesManifest = {
  version: number
  updatedAt: string
  groups: NoteGroup[]
  notes: Note[]
}

export const createEmptyManifest = (): NotesManifest => ({
  version: NOTES_MANIFEST_VERSION,
  updatedAt: new Date(0).toISOString(),
  groups: [],
  notes: [],
})
