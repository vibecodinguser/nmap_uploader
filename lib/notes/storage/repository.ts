import { createEmptyManifest, mergeManifests, type NotesManifest } from '../manifest'
import {
  createEmptyShard,
  type GeometryShard,
  removeShardGeometry,
  setShardGeometry,
  shardIdForDate,
} from '../shards'
import type { Note, NoteGeometry, NoteGroup } from '../types'
import type { NotesCache } from './cache'
import type { NotesRemote } from './remote'

export type NotesPorts = {
  remote: NotesRemote
  cache: NotesCache
}

export type NotesSnapshot = {
  manifest: NotesManifest
  /** Шарды геометрии по ключу `YYYY-MM`. */
  shards: Record<string, GeometryShard>
  /** Снимок собран из кэша и ещё не подтверждён Диском. */
  fromCache: boolean
}

export type NotesMutationResult = {
  manifest: NotesManifest
  shards: Record<string, GeometryShard>
}

const shardIdsOf = (manifest: NotesManifest): string[] => {
  const ids = new Set<string>()
  for (const note of manifest.notes) {
    const shardId = shardIdForDate(note.date)
    if (shardId) ids.add(shardId)
  }
  return [...ids].sort()
}

const readShard = async (ports: NotesPorts, shardId: string | null): Promise<GeometryShard> => {
  if (!shardId) return createEmptyShard()
  return (await ports.remote.readShard(shardId)) ?? createEmptyShard()
}

/** Снимок из кэша: панель может открыться до ответа Диска. */
export const loadCachedSnapshot = async (ports: NotesPorts): Promise<NotesSnapshot | null> => {
  const manifest = await ports.cache.readManifest()
  if (!manifest) return null

  const shards: Record<string, GeometryShard> = {}
  for (const shardId of shardIdsOf(manifest)) {
    const shard = await ports.cache.readShard(shardId)
    if (shard) shards[shardId] = shard
  }

  return { manifest, shards, fromCache: true }
}

/** Полный снимок с Диска: манифест и геометрия всех дат. */
export const loadRemoteSnapshot = async (ports: NotesPorts): Promise<NotesSnapshot> => {
  const manifest = (await ports.remote.readManifest()) ?? createEmptyManifest()
  const shards: Record<string, GeometryShard> = {}

  const loaded = await Promise.all(
    shardIdsOf(manifest).map(async (shardId) => ({
      shardId,
      shard: (await ports.remote.readShard(shardId)) ?? createEmptyShard(),
    })),
  )
  for (const { shardId, shard } of loaded) {
    shards[shardId] = shard
  }

  await ports.cache.writeManifest(manifest)
  await Promise.all(
    Object.entries(shards).map(([shardId, shard]) => ports.cache.writeShard(shardId, shard)),
  )

  return { manifest, shards, fromCache: false }
}

const writeManifest = async (
  ports: NotesPorts,
  manifest: NotesManifest,
): Promise<NotesManifest> => {
  const next = { ...manifest, updatedAt: new Date().toISOString() }
  await ports.remote.writeManifest(next)
  await ports.cache.writeManifest(next)
  return next
}

const writeShard = async (
  ports: NotesPorts,
  shardId: string,
  shard: GeometryShard,
): Promise<void> => {
  await ports.remote.writeShard(shardId, shard)
  await ports.cache.writeShard(shardId, shard)
}

/**
 * Сохраняет заметку и её геометрию.
 *
 * Читается только манифест и затронутые шарды: правка одной заметки не
 * переписывает геометрию остальных. Смена даты через границу месяца переносит
 * геометрию из старого шарда в новый.
 */
export const saveNote = async ({
  ports,
  note,
  geometry,
}: {
  ports: NotesPorts
  note: Note
  geometry: NoteGeometry
}): Promise<NotesMutationResult> => {
  const remoteManifest = (await ports.remote.readManifest()) ?? createEmptyManifest()
  const stamped: Note = { ...note, updatedAt: new Date().toISOString() }
  const manifest = mergeManifests(remoteManifest, {
    version: remoteManifest.version,
    updatedAt: stamped.updatedAt,
    groups: [],
    notes: [stamped],
  })

  const previous = remoteManifest.notes.find((item) => item.id === note.id)
  const nextShardId = shardIdForDate(stamped.date)
  const previousShardId = previous ? shardIdForDate(previous.date) : null

  const shards: Record<string, GeometryShard> = {}

  if (previousShardId && previousShardId !== nextShardId) {
    const previousShard = removeShardGeometry(await readShard(ports, previousShardId), stamped.id)
    await writeShard(ports, previousShardId, previousShard)
    shards[previousShardId] = previousShard
  }

  if (nextShardId) {
    const nextShard = setShardGeometry(await readShard(ports, nextShardId), stamped.id, geometry)
    await writeShard(ports, nextShardId, nextShard)
    shards[nextShardId] = nextShard
  }

  const savedManifest = await writeManifest(ports, manifest)
  return { manifest: savedManifest, shards }
}

/** Удаляет заметку вместе с геометрией. */
export const deleteNote = async ({
  ports,
  noteId,
}: {
  ports: NotesPorts
  noteId: string
}): Promise<NotesMutationResult> => {
  const remoteManifest = (await ports.remote.readManifest()) ?? createEmptyManifest()
  const target = remoteManifest.notes.find((note) => note.id === noteId)
  if (!target) {
    return { manifest: remoteManifest, shards: {} }
  }

  const manifest = await writeManifest(ports, {
    ...remoteManifest,
    notes: remoteManifest.notes.filter((note) => note.id !== noteId),
  })

  const shards: Record<string, GeometryShard> = {}
  const shardId = shardIdForDate(target.date)
  if (shardId) {
    const shard = removeShardGeometry(await readShard(ports, shardId), noteId)
    await writeShard(ports, shardId, shard)
    shards[shardId] = shard
  }

  return { manifest, shards }
}

export const saveGroup = async ({
  ports,
  group,
}: {
  ports: NotesPorts
  group: NoteGroup
}): Promise<NotesMutationResult> => {
  const remoteManifest = (await ports.remote.readManifest()) ?? createEmptyManifest()
  const stamped: NoteGroup = { ...group, updatedAt: new Date().toISOString() }
  const manifest = mergeManifests(remoteManifest, {
    version: remoteManifest.version,
    updatedAt: stamped.updatedAt,
    groups: [stamped],
    notes: [],
  })

  return { manifest: await writeManifest(ports, manifest), shards: {} }
}

/**
 * Удаляет группу.
 *
 * `keepNotes` оставляет заметки в корне, `cascade` удаляет их вместе с
 * геометрией.
 */
export const deleteGroup = async ({
  ports,
  groupId,
  mode,
}: {
  ports: NotesPorts
  groupId: string
  mode: 'keepNotes' | 'cascade'
}): Promise<NotesMutationResult> => {
  const remoteManifest = (await ports.remote.readManifest()) ?? createEmptyManifest()
  const doomed = remoteManifest.notes.filter((note) => note.groupId === groupId)

  const notes =
    mode === 'cascade'
      ? remoteManifest.notes.filter((note) => note.groupId !== groupId)
      : remoteManifest.notes.map((note) =>
          note.groupId === groupId ? { ...note, groupId: null } : note,
        )

  const manifest = await writeManifest(ports, {
    ...remoteManifest,
    notes,
    groups: remoteManifest.groups.filter((group) => group.id !== groupId),
  })

  if (mode !== 'cascade') {
    return { manifest, shards: {} }
  }

  const shards: Record<string, GeometryShard> = {}
  for (const note of doomed) {
    const shardId = shardIdForDate(note.date)
    if (!shardId) continue
    const base = shards[shardId] ?? (await readShard(ports, shardId))
    const shard = removeShardGeometry(base, note.id)
    await writeShard(ports, shardId, shard)
    shards[shardId] = shard
  }

  return { manifest, shards }
}

/** Переносит заметку в группу (или в корень при `groupId = null`). */
export const moveNoteToGroup = async ({
  ports,
  noteId,
  groupId,
}: {
  ports: NotesPorts
  noteId: string
  groupId: string | null
}): Promise<NotesMutationResult> => {
  const remoteManifest = (await ports.remote.readManifest()) ?? createEmptyManifest()
  const target = remoteManifest.notes.find((note) => note.id === noteId)
  if (!target) return { manifest: remoteManifest, shards: {} }

  const manifest = mergeManifests(remoteManifest, {
    version: remoteManifest.version,
    updatedAt: new Date().toISOString(),
    groups: [],
    notes: [{ ...target, groupId, updatedAt: new Date().toISOString() }],
  })

  return { manifest: await writeManifest(ports, manifest), shards: {} }
}
