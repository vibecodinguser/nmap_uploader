import { describe, expect, it } from 'vitest'
import { NOTES_MANIFEST_VERSION, type NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import { deleteNotes, moveNotesToGroup } from '@/lib/notes/storage/batch_repository'
import { createNoopNotesCache } from '@/lib/notes/storage/cache'
import type { NotesRemote } from '@/lib/notes/storage/remote'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

/**
 * Пакетные операции: смысл в том, что сто заметок стоят одну запись манифеста
 * и по одной на затронутый шард, а не сто повторов одиночной операции.
 */
const createMemoryRemote = () => {
  const files = new Map<string, unknown>()
  const writes: string[] = []
  const remote: NotesRemote = {
    readManifest: async () => (files.get('manifest') as NotesManifest | undefined) ?? null,
    writeManifest: async (manifest) => {
      files.set('manifest', manifest)
      writes.push('manifest')
    },
    readShard: async (shardId) =>
      (files.get(`shard:${shardId}`) as GeometryShard | undefined) ?? null,
    writeShard: async (shardId, shard) => {
      files.set(`shard:${shardId}`, shard)
      writes.push(`shard:${shardId}`)
    },
    readIcon: async () => null,
    writeIcon: async () => {},
  }
  return { remote, files, writes }
}

const ports = (remote: NotesRemote) => ({ remote, cache: createNoopNotesCache() })

const point = { kind: 'Point' as const, coords: [37, 55] as [number, number] }

const manifestWith = (notes: NotesManifest['notes'], groups: NotesManifest['groups'] = []) => ({
  version: NOTES_MANIFEST_VERSION,
  updatedAt: '2026-11-16T10:00:00.000Z',
  groups,
  notes,
  deletedNotes: [],
})

describe('массовое удаление', () => {
  it('удаляет несколько заметок одной записью манифеста', async () => {
    const { remote, files, writes } = createMemoryRemote()
    files.set(
      'manifest',
      manifestWith([sampleNote({ id: 'a' }), sampleNote({ id: 'b' }), sampleNote({ id: 'c' })]),
    )
    files.set('shard:2026-11', {
      version: 1,
      updatedAt: 'x',
      notes: { a: point, b: point, c: point },
    })

    await deleteNotes({ ports: ports(remote), noteIds: ['a', 'c'] })

    const saved = files.get('manifest') as NotesManifest
    expect(saved.notes.map((note) => note.id)).toEqual(['b'])
    // Манифест записан ровно один раз, шард — тоже (все в одном месяце).
    expect(writes.filter((write) => write === 'manifest')).toHaveLength(1)
    expect(writes.filter((write) => write === 'shard:2026-11')).toHaveLength(1)
    expect((files.get('shard:2026-11') as GeometryShard).notes).toEqual({ b: point })
  })

  it('чистит геометрию во всех затронутых шардах', async () => {
    const { remote, files } = createMemoryRemote()
    files.set(
      'manifest',
      manifestWith([
        sampleNote({ id: 'nov', date: '14-11-2026' }),
        sampleNote({ id: 'dec', date: '01-12-2026' }),
      ]),
    )
    files.set('shard:2026-11', { version: 1, updatedAt: 'x', notes: { nov: point } })
    files.set('shard:2026-12', { version: 1, updatedAt: 'x', notes: { dec: point } })

    await deleteNotes({ ports: ports(remote), noteIds: ['nov', 'dec'] })

    expect((files.get('shard:2026-11') as GeometryShard).notes).toEqual({})
    expect((files.get('shard:2026-12') as GeometryShard).notes).toEqual({})
  })

  it('несуществующие id не трогают файлы', async () => {
    const { remote, files, writes } = createMemoryRemote()
    files.set('manifest', manifestWith([sampleNote({ id: 'a' })]))

    await deleteNotes({ ports: ports(remote), noteIds: ['nope'] })

    expect(writes).toEqual([])
  })

  it('не мешает удалить заметку из группы', async () => {
    const { remote, files } = createMemoryRemote()
    files.set(
      'manifest',
      manifestWith([sampleNote({ id: 'a', groupId: 'group-1' })], [sampleGroup()]),
    )

    await deleteNotes({ ports: ports(remote), noteIds: ['a'] })

    const saved = files.get('manifest') as NotesManifest
    expect(saved.notes).toEqual([])
    // Группа остаётся: удаляли заметки, а не группу.
    expect(saved.groups).toHaveLength(1)
  })
})

describe('массовый перенос', () => {
  it('переносит пачку одной записью и одной меткой времени', async () => {
    const { remote, files, writes } = createMemoryRemote()
    files.set(
      'manifest',
      manifestWith([sampleNote({ id: 'a' }), sampleNote({ id: 'b' })], [sampleGroup()]),
    )

    await moveNotesToGroup({
      ports: ports(remote),
      noteIds: ['a', 'b'],
      groupId: 'group-1',
    })

    const saved = files.get('manifest') as NotesManifest
    expect(saved.notes.every((note) => note.groupId === 'group-1')).toBe(true)
    expect(new Set(saved.notes.map((note) => note.updatedAt)).size).toBe(1)
    expect(writes).toEqual(['manifest'])
  })

  it('несуществующая группа превращается в корень', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', manifestWith([sampleNote({ id: 'a', groupId: 'group-1' })]))

    await moveNotesToGroup({
      ports: ports(remote),
      noteIds: ['a'],
      groupId: 'deleted-group',
    })

    const saved = files.get('manifest') as NotesManifest
    expect(saved.notes[0]?.groupId).toBeNull()
  })

  it('перенос в корень работает без групп', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', manifestWith([sampleNote({ id: 'a', groupId: 'group-1' })]))

    await moveNotesToGroup({ ports: ports(remote), noteIds: ['a'], groupId: null })

    expect((files.get('manifest') as NotesManifest).notes[0]?.groupId).toBeNull()
  })

  it('остальные заметки не меняются', async () => {
    const { remote, files } = createMemoryRemote()
    files.set(
      'manifest',
      manifestWith([sampleNote({ id: 'a' }), sampleNote({ id: 'b' })], [sampleGroup()]),
    )

    await moveNotesToGroup({ ports: ports(remote), noteIds: ['a'], groupId: 'group-1' })

    const saved = files.get('manifest') as NotesManifest
    const untouched = saved.notes.find((note) => note.id === 'b')
    expect(untouched?.groupId).toBeNull()
    expect(untouched?.updatedAt).toBe('2026-11-14T10:00:00.000Z')
  })
})
