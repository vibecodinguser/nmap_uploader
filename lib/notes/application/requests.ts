import { normalizeGeometry, normalizeGroup, normalizeNote } from '../model/manifest'
import type { Note, NoteGeometry, NoteGroup } from '../model/types'

/**
 * Разбор входящих сообщений.
 *
 * Функции чистые: принимают `Record<string, unknown>` из `sendMessage` и
 * возвращают либо типизированный запрос, либо причину отказа. Ни браузера, ни
 * Диска здесь нет, поэтому весь контракт сообщений проверяется юнит-тестами.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const invalid = (): { ok: false; error: string } => ({ ok: false, error: 'INVALID_PAYLOAD' })

export type SaveNoteRequest = { note: Note; geometry: NoteGeometry }

export const parseSaveNoteRequest = (message: Record<string, unknown>): Parsed<SaveNoteRequest> => {
  const note = normalizeNote(message.note)
  const geometry = normalizeGeometry(message.geometry)
  if (!note || !geometry) return invalid()
  return { ok: true, value: { note, geometry } }
}

export type DeleteNoteRequest = { noteId: string; date?: string }

export const parseDeleteNoteRequest = (
  message: Record<string, unknown>,
): Parsed<DeleteNoteRequest> => {
  if (typeof message.noteId !== 'string') return invalid()
  const date = typeof message.date === 'string' ? message.date : undefined
  return { ok: true, value: { noteId: message.noteId, date } }
}

export type SaveGroupRequest = { group: NoteGroup }

export const parseSaveGroupRequest = (
  message: Record<string, unknown>,
): Parsed<SaveGroupRequest> => {
  const group = normalizeGroup(message.group)
  if (!group) return invalid()
  return { ok: true, value: { group } }
}

export type DeleteGroupRequest = { groupId: string; mode: 'keepNotes' | 'cascade' }

export const parseDeleteGroupRequest = (
  message: Record<string, unknown>,
): Parsed<DeleteGroupRequest> => {
  if (typeof message.groupId !== 'string') return invalid()
  // Всё, кроме явного `cascade`, распускает группу: заметки дороже структуры.
  const mode = message.mode === 'cascade' ? 'cascade' : 'keepNotes'
  return { ok: true, value: { groupId: message.groupId, mode } }
}

export type MoveNoteRequest = { noteId: string; groupId: string | null }

export const parseMoveNoteRequest = (message: Record<string, unknown>): Parsed<MoveNoteRequest> => {
  if (typeof message.noteId !== 'string') return invalid()
  const groupId = typeof message.groupId === 'string' ? message.groupId : null
  return { ok: true, value: { noteId: message.noteId, groupId } }
}

/** Скрытые id приходят из панели; мусор в массиве отбрасывается, а не роняет запрос. */
export const parseHiddenIds = (message: Record<string, unknown>): Parsed<string[]> => {
  if (!Array.isArray(message.hiddenIds)) return invalid()
  return {
    ok: true,
    value: message.hiddenIds.filter((id): id is string => typeof id === 'string'),
  }
}
