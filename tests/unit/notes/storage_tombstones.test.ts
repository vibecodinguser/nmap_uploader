import { describe, expect, it } from 'vitest'
import { NOTES_MANIFEST_VERSION, type NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import { deleteNotes } from '@/lib/notes/storage/batch_repository'
import { createNoopNotesCache } from '@/lib/notes/storage/cache'
import { deleteGroup } from '@/lib/notes/storage/group_repository'
import type { NotesRemote } from '@/lib/notes/storage/remote'
import { deleteNote, saveNote } from '@/lib/notes/storage/repository'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

/**
 * Удаление должно оставлять надгробие в файле на Диске — иначе другое
 * устройство вернёт заметку при следующем слиянии.
 */
const createMemoryRemote = () => {
  const files = new Map<string, unknown>()
  const remote: NotesRemote = {
    readManifest: async () => (files.get('manifest') as NotesManifest | undefined) ?? null,
    writeManifest: async (manifest) => {
      files.set('manifest', manifest)
    },
    readShard: async (shardId) =>
      (files.get(`shard:${shardId}`) as GeometryShard | undefined) ?? null,
    writeShard: async (shardId, shard) => {
      files.set(`shard:${shardId}`, shard)
    },
    readIcon: async () => null,
    writeIcon: async () => {},
  }
  return { remote, files }
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

const savedManifest = (files: Map<string, unknown>): NotesManifest =>
  files.get('manifest') as NotesManifest

describe('удаление пишет надгробие', () => {
  it('одиночное удаление оставляет надгробие с датой', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', manifestWith([sampleNote({ id: 'note-1' })]))
    files.set('shard:2026-11', { version: 1, updatedAt: 'x', notes: { 'note-1': point } })

    await deleteNote({ ports: ports(remote), noteId: 'note-1', date: '16-11-2026' })

    const saved = savedManifest(files)
    expect(saved.notes).toEqual([])
    expect(saved.deletedNotes).toHaveLength(1)
    expect(saved.deletedNotes[0]?.id).toBe('note-1')
    expect(Number.isNaN(Date.parse(saved.deletedNotes[0]?.deletedAt ?? ''))).toBe(false)
  })

  it('надгробие заведомо позже последней правки заметки', async () => {
    const { remote, files } = createMemoryRemote()
    // Метка правки в будущем: без защиты удаление было бы «старше» правки.
    const future = new Date(Date.now() + 60_000).toISOString()
    files.set('manifest', manifestWith([sampleNote({ id: 'note-1', updatedAt: future })]))

    await deleteNote({ ports: ports(remote), noteId: 'note-1', date: '16-11-2026' })

    const tombstone = savedManifest(files).deletedNotes[0]
    expect(Date.parse(tombstone?.deletedAt ?? '')).toBeGreaterThan(Date.parse(future))
  })

  it('массовое удаление оставляет надгробие на каждую заметку', async () => {
    const { remote, files } = createMemoryRemote()
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

    const saved = savedManifest(files)
    expect(saved.deletedNotes.map((tombstone) => tombstone.id).sort()).toEqual(['a', 'c'])
    expect(saved.notes.map((note) => note.id)).toEqual(['b'])
  })

  it('каскадное удаление группы оставляет надгробия её заметок', async () => {
    const { remote, files } = createMemoryRemote()
    files.set(
      'manifest',
      manifestWith(
        [
          sampleNote({ id: 'a', groupId: 'group-1' }),
          sampleNote({ id: 'b', groupId: 'group-1' }),
          sampleNote({ id: 'c' }),
        ],
        [sampleGroup()],
      ),
    )
    files.set('shard:2026-11', {
      version: 1,
      updatedAt: 'x',
      notes: { a: point, b: point, c: point },
    })

    await deleteGroup({ ports: ports(remote), groupId: 'group-1', mode: 'cascade' })

    const saved = savedManifest(files)
    expect(saved.deletedNotes.map((tombstone) => tombstone.id).sort()).toEqual(['a', 'b'])
    expect(saved.notes.map((note) => note.id)).toEqual(['c'])
  })

  it('роспуск группы надгробий не оставляет: заметки остались', async () => {
    const { remote, files } = createMemoryRemote()
    files.set(
      'manifest',
      manifestWith([sampleNote({ id: 'a', groupId: 'group-1' })], [sampleGroup()]),
    )

    await deleteGroup({ ports: ports(remote), groupId: 'group-1', mode: 'keepNotes' })

    expect(savedManifest(files).deletedNotes).toEqual([])
  })
})

describe('возврат удалённой заметки', () => {
  it('сохранение после удаления снимает надгробие', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', {
      ...manifestWith([]),
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T10:00:00.000Z' }],
    })

    // «Отменить»: заметка сохраняется заново с новой меткой.
    await saveNote({
      ports: ports(remote),
      note: sampleNote({ id: 'note-1', updatedAt: '2026-11-16T11:00:00.000Z' }),
      geometry: point,
    })

    const saved = savedManifest(files)
    expect(saved.notes.map((note) => note.id)).toEqual(['note-1'])
    // Иначе следующее слияние удалило бы её снова.
    expect(saved.deletedNotes).toEqual([])
  })

  it('старое сохранение не воскрешает удалённую заметку', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', {
      ...manifestWith([]),
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T10:00:00.000Z' }],
    })

    // Отложенная правка, отправленная до удаления.
    await saveNote({
      ports: ports(remote),
      note: sampleNote({ id: 'note-1', updatedAt: '2026-11-16T09:00:00.000Z' }),
      geometry: point,
    })

    const saved = savedManifest(files)
    expect(saved.notes).toEqual([])
    expect(saved.deletedNotes.map((tombstone) => tombstone.id)).toEqual(['note-1'])
  })
})

describe('очистка при записи', () => {
  it('просроченные надгробия не попадают в файл', async () => {
    const { remote, files } = createMemoryRemote()
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    files.set('manifest', {
      ...manifestWith([sampleNote({ id: 'a' })]),
      deletedNotes: [{ id: 'long-gone', deletedAt: old }],
    })

    await saveNote({
      ports: ports(remote),
      note: sampleNote({ id: 'a', updatedAt: new Date().toISOString() }),
      geometry: point,
    })

    expect(savedManifest(files).deletedNotes).toEqual([])
  })
})
