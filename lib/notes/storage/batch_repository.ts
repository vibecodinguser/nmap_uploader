import { createEmptyManifest, mergeManifests } from '../model/manifest'
import { type GeometryShard, removeShardGeometry, shardIdForDate } from '../model/shards'
import type { NotesPatch } from '../protocol'
import { enqueueNotesWrite } from './write_queue'
import { type NotesPorts, readShard, withTombstone, writeManifest, writeShard } from './writes'

/**
 * Пакетные операции над заметками.
 *
 * Массовое действие над сотней заметок — это одна запись манифеста и по одной
 * записи на затронутый шард, а не сто повторов одиночной операции. Одиночный
 * путь для этого не годится: он читает и переписывает манифест на каждую
 * заметку, и на сотне объектов это сто лишних запросов к Диску.
 */

/**
 * Удаляет заметки пачкой.
 *
 * Геометрия удаляется вместе с заметками: иначе шарды копили бы записи, для
 * которых нет ни одной заметки в манифесте.
 */
const deleteNotesNow = async ({
  ports,
  noteIds,
}: {
  ports: NotesPorts
  noteIds: readonly string[]
}): Promise<NotesPatch> => {
  const remoteManifest = (await ports.remote.readManifest()) ?? createEmptyManifest()
  const doomed = new Set(noteIds)
  const removed = remoteManifest.notes.filter((note) => doomed.has(note.id))
  if (removed.length === 0) return { manifest: remoteManifest, shards: {} }

  // Каждой удалённой заметке — своё надгробие: без него другое устройство
  // вернуло бы её при следующем слиянии.
  const withTombstones = removed.reduce(
    (manifest, note) => withTombstone(manifest, note.id, note.updatedAt),
    remoteManifest,
  )
  const manifest = await writeManifest(ports, withTombstones)

  // Один шард на месяц, а не на заметку: удаляемые могут лежать в одном файле.
  const shardIds = new Set<string>()
  for (const note of removed) {
    const shardId = shardIdForDate(note.date)
    if (shardId) shardIds.add(shardId)
  }

  const shards: Record<string, GeometryShard> = {}
  await Promise.all(
    [...shardIds].map(async (shardId) => {
      let shard = await readShard(ports, shardId)
      for (const note of removed) {
        if (shardIdForDate(note.date) === shardId) shard = removeShardGeometry(shard, note.id)
      }
      await writeShard(ports, shardId, shard)
      shards[shardId] = shard
    }),
  )

  return { manifest, shards }
}

/**
 * Переносит заметки в группу (или в корень) пачкой.
 *
 * Несуществующая группа превращается в корень — то же правило, что и для
 * одиночного переноса: висячая ссылка портит данные, хотя пользователю и не
 * видна.
 */
const moveNotesToGroupNow = async ({
  ports,
  noteIds,
  groupId,
}: {
  ports: NotesPorts
  noteIds: readonly string[]
  groupId: string | null
}): Promise<NotesPatch> => {
  const remoteManifest = (await ports.remote.readManifest()) ?? createEmptyManifest()
  const targets = new Set(noteIds)
  const known = groupId !== null && remoteManifest.groups.some((group) => group.id === groupId)
  const nextGroupId = known ? groupId : null
  const timestamp = new Date().toISOString()

  const touched = remoteManifest.notes.filter((note) => targets.has(note.id))
  if (touched.length === 0) return { manifest: remoteManifest, shards: {} }

  // Одна общая метка времени на всю пачку: так проще сверять с другим
  // устройством, и лишних различий между заметками одной операции не остаётся.
  const moved = touched.map((note) => ({ ...note, groupId: nextGroupId, updatedAt: timestamp }))
  const byId = new Map(moved.map((note) => [note.id, note]))

  const manifest = mergeManifests(remoteManifest, {
    version: remoteManifest.version,
    updatedAt: timestamp,
    groups: [],
    notes: moved,
    deletedNotes: [],
  })
  // Применяем перенос ко всему манифесту: `mergeManifests` может оставить
  // серверную версию заметки, если она новее.
  manifest.notes = manifest.notes.map((note) => byId.get(note.id) ?? note)

  return { manifest: await writeManifest(ports, manifest), shards: {} }
}

export const deleteNotes = (args: Parameters<typeof deleteNotesNow>[0]) =>
  enqueueNotesWrite(() => deleteNotesNow(args))
export const moveNotesToGroup = (args: Parameters<typeof moveNotesToGroupNow>[0]) =>
  enqueueNotesWrite(() => moveNotesToGroupNow(args))
