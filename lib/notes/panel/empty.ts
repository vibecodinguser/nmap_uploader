import type { NotesSnapshot } from '@/lib/notes/protocol'

/**
 * Снимок до первой загрузки.
 *
 * Создание работает и на пустом состоянии: пользователь может нарисовать
 * заметку раньше, чем ответит Диск.
 */
export const EMPTY_NOTES_SNAPSHOT: NotesSnapshot = {
  manifest: { version: 1, updatedAt: new Date(0).toISOString(), groups: [], notes: [] },
  shards: {},
  hiddenIds: [],
}
