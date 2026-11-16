import type { NotesManifest } from '../model/manifest'
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

export const writeManifest = async (
  ports: NotesPorts,
  manifest: NotesManifest,
): Promise<NotesManifest> => {
  const next = { ...manifest, updatedAt: new Date().toISOString() }
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
