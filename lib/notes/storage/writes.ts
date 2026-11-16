import { type NotesManifest, pruneTombstones } from '../model/manifest'
import { createEmptyShard, type GeometryShard } from '../model/shards'
import type { NotesCache } from './cache'
import type { NotesRemote } from './remote'

/**
 * Общие чтения и записи файлов заметок.
 *
 * Вынесено из репозитория, потому что и заметки, и группы пишут один и тот же
 * манифест: без общего места `updatedAt` и запись в кэш разъезжались бы.
 */

export type NotesPorts = {
  remote: NotesRemote
  cache: NotesCache
}

export const readShard = async (
  ports: NotesPorts,
  shardId: string | null,
): Promise<GeometryShard> => {
  if (!shardId) return createEmptyShard()
  return (await ports.remote.readShard(shardId)) ?? createEmptyShard()
}

/**
 * Помечает заметку удалённой и убирает её из манифеста.
 *
 * Надгробие — единственный способ передать удаление: по отсутствию записи
 * другой манифест не отличит «удалено» от «я этого ещё не видел» и вернёт
 * заметку при слиянии.
 *
 * `noteUpdatedAt` нужен, чтобы дата удаления была заведомо позже правки: иначе
 * слияние сочло бы заметку более свежей и воскресило её.
 */
export const withTombstone = (
  manifest: NotesManifest,
  noteId: string,
  noteUpdatedAt?: string,
): NotesManifest => {
  const now = Date.now()
  const updatedAt = noteUpdatedAt ? Math.max(now, Date.parse(noteUpdatedAt) + 1) : now
  const deletedAt = new Date(updatedAt).toISOString()

  return {
    ...manifest,
    notes: manifest.notes.filter((note) => note.id !== noteId),
    deletedNotes: [
      ...manifest.deletedNotes.filter((tombstone) => tombstone.id !== noteId),
      { id: noteId, deletedAt },
    ],
  }
}

export const writeManifest = async (
  ports: NotesPorts,
  manifest: NotesManifest,
): Promise<NotesManifest> => {
  // Единственный шлюз записи: здесь же чистим надгробия, срок которых вышел.
  const next = {
    ...manifest,
    updatedAt: new Date().toISOString(),
    deletedNotes: pruneTombstones(manifest.deletedNotes),
  }
  await ports.remote.writeManifest(next)
  await ports.cache.writeManifest(next)
  return next
}

export const writeShard = async (
  ports: NotesPorts,
  shardId: string,
  shard: GeometryShard,
): Promise<void> => {
  await ports.remote.writeShard(shardId, shard)
  await ports.cache.writeShard(shardId, shard)
}
