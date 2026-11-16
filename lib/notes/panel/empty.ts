import { NOTES_MANIFEST_VERSION } from '@/lib/notes/model/manifest'
import type { NotesSnapshot } from '@/lib/notes/protocol'

/**
 * Снимок до первой загрузки.
 *
 * Создание работает и на пустом состоянии: пользователь может нарисовать
 * заметку раньше, чем ответит Диск.
 */
export const EMPTY_NOTES_SNAPSHOT: NotesSnapshot = {
  manifest: {
    version: NOTES_MANIFEST_VERSION,
    updatedAt: new Date(0).toISOString(),
    groups: [],
    notes: [],
    deletedNotes: [],
  },
  shards: {},
  hiddenIds: [],
}
