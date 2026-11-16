import { createEmptyManifest, mergeManifests } from '../model/manifest'
import { type GeometryShard, removeShardGeometry, shardIdForDate } from '../model/shards'
import type { NoteGroup } from '../model/types'
import type { NotesPatch } from '../protocol'
import { enqueueNotesWrite } from './write_queue'
import { type NotesPorts, readShard, writeManifest, writeShard } from './writes'

/**
 * Мутации групп.
 *
 * Группа живёт только в манифесте, поэтому отдельный шард ей не нужен. Удаление
 * с `cascade` заодно вычищает геометрию заметок — это единственная групповая
 * операция, которая трогает шарды.
 */

const saveGroupNow = async ({
  ports,
  group,
}: {
  ports: NotesPorts
  group: NoteGroup
}): Promise<NotesPatch> => {
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
}): Promise<NotesPatch> => {
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
}): Promise<NotesPatch> => {
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

export const saveGroup = (args: Parameters<typeof saveGroupNow>[0]) =>
  enqueueNotesWrite(() => saveGroupNow(args))
export const deleteGroup = (args: Parameters<typeof deleteGroupNow>[0]) =>
  enqueueNotesWrite(() => deleteGroupNow(args))
export const moveNoteToGroup = (args: Parameters<typeof moveNoteToGroupNow>[0]) =>
  enqueueNotesWrite(() => moveNoteToGroupNow(args))
