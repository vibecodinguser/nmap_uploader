import { describe, expect, it } from 'vitest'
import { NOTES_MANIFEST_VERSION, type NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import { createNoopNotesCache } from '@/lib/notes/storage/cache'
import type { NotesRemote } from '@/lib/notes/storage/remote'
import { deleteGroup, moveNoteToGroup, saveGroup } from '@/lib/notes/storage/repository'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

/**
 * Группы в хранилище: роспуск, каскад и перенос.
 *
 * Отдельный файл: `repository.test.ts` про заметки и шарды, здесь — групповые
 * правила, которые меняют метки времени и проверяют существование группы.
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

const manifest = (notes: Note[], groups: NoteGroup[]): NotesManifest => ({
  version: NOTES_MANIFEST_VERSION,
  updatedAt: '2026-11-16T10:00:00.000Z',
  groups,
  notes,
  deletedNotes: [],
})

describe('роспуск группы', () => {
  it('убирает группу у заметок и обновляет их метку времени', async () => {
    const { remote, files } = createMemoryRemote()
    files.set(
      'manifest',
      manifest([sampleNote({ id: 'note-1', groupId: 'group-1' })], [sampleGroup()]),
    )

    await deleteGroup({ ports: ports(remote), groupId: 'group-1', mode: 'keepNotes' })

    const saved = files.get('manifest') as NotesManifest
    expect(saved.groups).toEqual([])
    expect(saved.notes[0]?.groupId).toBeNull()
    // Без новой метки на другом устройстве победила бы локальная копия
    // со старой группой, и роспуск бы не применился.
    expect(saved.notes[0]?.updatedAt).not.toBe('2026-11-14T10:00:00.000Z')
  })

  it('не трогает заметки из других групп', async () => {
    const { remote, files } = createMemoryRemote()
    files.set(
      'manifest',
      manifest(
        [
          sampleNote({ id: 'note-1', groupId: 'group-1' }),
          sampleNote({ id: 'note-2', groupId: 'group-2' }),
        ],
        [sampleGroup({ id: 'group-1' }), sampleGroup({ id: 'group-2', name: 'Мосты' })],
      ),
    )

    await deleteGroup({ ports: ports(remote), groupId: 'group-1', mode: 'keepNotes' })

    const saved = files.get('manifest') as NotesManifest
    expect(saved.notes.find((note) => note.id === 'note-2')?.groupId).toBe('group-2')
    expect(saved.notes.find((note) => note.id === 'note-2')?.updatedAt).toBe(
      '2026-11-14T10:00:00.000Z',
    )
  })

  it('каскад удаляет заметки вместе с геометрией', async () => {
    const { remote, files } = createMemoryRemote()
    files.set(
      'manifest',
      manifest([sampleNote({ id: 'note-1', groupId: 'group-1' })], [sampleGroup()]),
    )
    files.set('shard:2026-11', {
      version: 1,
      updatedAt: '2026-11-16T10:00:00.000Z',
      notes: { 'note-1': { kind: 'Point', coords: [37, 55] } },
    })

    await deleteGroup({ ports: ports(remote), groupId: 'group-1', mode: 'cascade' })

    const saved = files.get('manifest') as NotesManifest
    expect(saved.notes).toEqual([])
    expect((files.get('shard:2026-11') as GeometryShard).notes).toEqual({})
  })
})

describe('перенос в группу', () => {
  it('переносит в существующую группу', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', manifest([sampleNote({ id: 'note-1' })], [sampleGroup()]))

    const patch = await moveNoteToGroup({
      ports: ports(remote),
      noteId: 'note-1',
      groupId: 'group-1',
    })

    expect(patch.manifest.notes[0]?.groupId).toBe('group-1')
  })

  it('не оставляет ссылку на группу, которой нет', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', manifest([sampleNote({ id: 'note-1' })], []))

    const patch = await moveNoteToGroup({
      ports: ports(remote),
      noteId: 'note-1',
      groupId: 'group-deleted',
    })

    // Висячий groupId не виден пользователю, но портит данные: заметка
    // попадает в корень и в файле.
    expect(patch.manifest.notes[0]?.groupId).toBeNull()
  })

  it('идущий на Диск снимок не содержит висячей ссылки', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', manifest([sampleNote({ id: 'note-1' })], []))

    await moveNoteToGroup({ ports: ports(remote), noteId: 'note-1', groupId: 'group-deleted' })

    expect((files.get('manifest') as NotesManifest).notes[0]?.groupId).toBeNull()
  })

  it('перенос в корень работает без групп', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', manifest([sampleNote({ id: 'note-1', groupId: 'group-1' })], []))

    const patch = await moveNoteToGroup({
      ports: ports(remote),
      noteId: 'note-1',
      groupId: null,
    })

    expect(patch.manifest.notes[0]?.groupId).toBeNull()
  })
})

describe('сохранение группы', () => {
  it('создаёт и переименовывает группу одним запросом', async () => {
    const { remote, files } = createMemoryRemote()
    files.set('manifest', manifest([], []))

    await saveGroup({ ports: ports(remote), group: sampleGroup({ id: 'group-1', name: 'Первая' }) })
    await saveGroup({
      ports: ports(remote),
      group: sampleGroup({ id: 'group-1', name: 'Вторая' }),
    })

    const saved = files.get('manifest') as NotesManifest
    expect(saved.groups).toHaveLength(1)
    expect(saved.groups[0]?.name).toBe('Вторая')
  })
})
