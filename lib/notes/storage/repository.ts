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
import { enqueueNotesWrite } from './write_queue'

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

const isValidTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

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
const saveNoteNow = async ({
  ports,
  note,
  geometry,
}: {
  ports: NotesPorts
  note: Note
  geometry: NoteGeometry
}): Promise<NotesMutationResult> => {
  // `updatedAt` приходит от клиента и НЕ перештамповывается здесь: иначе
  // отложенная правка, отправленная раньше переноса в группу, но выполненная
  // позже, получала бы самый свежий штамп и затирала перенос — заметка
  // возвращалась в корень.
  const stamped: Note = {
    ...note,
    updatedAt: isValidTimestamp(note.updatedAt) ? note.updatedAt : new Date().toISOString(),
  }
  const nextShardId = shardIdForDate(stamped.date)

  // Манифест и шард читаются параллельно: месяц известен из даты заметки,
  // поэтому ждать манифест ради поиска шарда незачем.
  const [remoteManifest, prefetchedShard] = await Promise.all([
    ports.remote.readManifest().then((value) => value ?? createEmptyManifest()),
    nextShardId ? ports.remote.readShard(nextShardId).catch(() => null) : Promise.resolve(null),
  ])

  const manifest = mergeManifests(remoteManifest, {
    version: remoteManifest.version,
    updatedAt: stamped.updatedAt,
    groups: [],
    notes: [stamped],
  })

  const previous = remoteManifest.notes.find((item) => item.id === note.id)
  const previousShardId = previous ? shardIdForDate(previous.date) : null
  const movedBetweenShards = Boolean(previousShardId && previousShardId !== nextShardId)

  const shards: Record<string, GeometryShard> = {}
  const shardWrites: Array<Promise<unknown>> = []

  if (movedBetweenShards && previousShardId) {
    const previousShard = removeShardGeometry(await readShard(ports, previousShardId), stamped.id)
    shards[previousShardId] = previousShard
    shardWrites.push(writeShard(ports, previousShardId, previousShard))
  }

  if (nextShardId) {
    const base = prefetchedShard ?? (await readShard(ports, nextShardId))
    const nextShard = setShardGeometry(base, stamped.id, geometry)
    shards[nextShardId] = nextShard
    shardWrites.push(writeShard(ports, nextShardId, nextShard))
  }

  // Манифест и шарды — разные файлы, их можно отправить одновременно.
  const [savedManifest] = await Promise.all([writeManifest(ports, manifest), ...shardWrites])
  return { manifest: savedManifest, shards }
}

/** Удаляет заметку вместе с геометрией. */
const deleteNoteNow = async ({
  ports,
  noteId,
  date,
}: {
  ports: NotesPorts
  noteId: string
  /** Дата заметки из панели: позволяет читать шард, не дожидаясь манифеста. */
  date?: string
}): Promise<NotesMutationResult> => {
  const hintedShardId = date ? shardIdForDate(date) : null

  // Манифест и шард читаются параллельно: панель знает дату заметки, поэтому
  // искать шард по манифесту не нужно. Это экономит два round-trip.
  const [remoteManifest, prefetchedShard] = await Promise.all([
    ports.remote.readManifest().then((value) => value ?? createEmptyManifest()),
    hintedShardId ? ports.remote.readShard(hintedShardId).catch(() => null) : Promise.resolve(null),
  ])

  const target = remoteManifest.notes.find((note) => note.id === noteId)
  if (!target) {
    return { manifest: remoteManifest, shards: {} }
  }

  const shardId = shardIdForDate(target.date)
  const baseShard =
    shardId && shardId === hintedShardId && prefetchedShard
      ? prefetchedShard
      : shardId
        ? await readShard(ports, shardId)
        : null

  const shard = shardId && baseShard ? removeShardGeometry(baseShard, noteId) : null

  // Запись манифеста и шарда независима: два файла можно отправить разом.
  const [manifest] = await Promise.all([
    writeManifest(ports, {
      ...remoteManifest,
      notes: remoteManifest.notes.filter((note) => note.id !== noteId),
    }),
    shardId && shard ? writeShard(ports, shardId, shard) : Promise.resolve(),
  ])

  return { manifest, shards: shardId && shard ? { [shardId]: shard } : {} }
}

const saveGroupNow = async ({
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
const deleteGroupNow = async ({
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
const moveNoteToGroupNow = async ({
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

/*
 * Наружу изменения отдаются через очередь записи: одновременно идущие
 * операции писали один и тот же файл, и Яндекс.Диск отвечал `423 LOCKED`.
 */
export const saveNote = (args: Parameters<typeof saveNoteNow>[0]) =>
  enqueueNotesWrite(() => saveNoteNow(args))
export const deleteNote = (args: Parameters<typeof deleteNoteNow>[0]) =>
  enqueueNotesWrite(() => deleteNoteNow(args))
export const saveGroup = (args: Parameters<typeof saveGroupNow>[0]) =>
  enqueueNotesWrite(() => saveGroupNow(args))
export const deleteGroup = (args: Parameters<typeof deleteGroupNow>[0]) =>
  enqueueNotesWrite(() => deleteGroupNow(args))
export const moveNoteToGroup = (args: Parameters<typeof moveNoteToGroupNow>[0]) =>
  enqueueNotesWrite(() => moveNoteToGroupNow(args))
