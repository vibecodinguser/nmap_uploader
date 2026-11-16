import { describe, expect, it } from 'vitest'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import {
  createCachingNotesRemote,
  NOTES_READ_CACHE_TTL_MS,
} from '@/lib/notes/storage/caching_remote'
import type { NotesRemote } from '@/lib/notes/storage/remote'
import { sampleNote } from '@/tests/unit/notes_panel/list_props'

/**
 * Кэш чтений: серия правок не перечитывает одно и то же, но явная загрузка и
 * ошибка записи всегда идут на Диск.
 */
const manifest = (name = 'Заметка'): NotesManifest => ({
  version: 1,
  updatedAt: '2026-11-16T10:00:00.000Z',
  groups: [],
  notes: [sampleNote({ id: 'note-1', name })],
})

const shard = (shardId: string): GeometryShard => ({
  version: 1,
  updatedAt: '2026-11-16T10:00:00.000Z',
  notes: { 'note-1': { kind: 'Point', coords: [shardId.length, 55] } },
})

const createRemote = () => {
  const reads = { manifest: 0, shard: 0 }
  const writes = { manifest: 0, shard: 0 }
  const remote: NotesRemote = {
    readManifest: async () => {
      reads.manifest += 1
      return manifest()
    },
    writeManifest: async () => {
      writes.manifest += 1
    },
    readShard: async (shardId) => {
      reads.shard += 1
      return shard(shardId)
    },
    writeShard: async () => {
      writes.shard += 1
    },
    readIcon: async () => null,
    writeIcon: async () => {},
  }
  return { remote, reads, writes }
}

describe('кэш чтений заметок', () => {
  it('повторное чтение манифеста не идёт на Диск', async () => {
    const { remote, reads } = createRemote()
    const caching = createCachingNotesRemote(remote, { now: () => 0 })

    await caching.readManifest()
    await caching.readManifest()
    await caching.readManifest()

    expect(reads.manifest).toBe(1)
  })

  it('повторное чтение шарда не идёт на Диск', async () => {
    const { remote, reads } = createRemote()
    const caching = createCachingNotesRemote(remote, { now: () => 0 })

    await caching.readShard('2026-11')
    await caching.readShard('2026-11')
    await caching.readShard('2026-12')

    expect(reads.shard).toBe(2)
  })

  it('после TTL читает заново: правки с другого устройства доезжают', async () => {
    const { remote, reads } = createRemote()
    let now = 0
    const caching = createCachingNotesRemote(remote, { now: () => now })

    await caching.readManifest()
    now = NOTES_READ_CACHE_TTL_MS
    await caching.readManifest()

    expect(reads.manifest).toBe(2)
  })

  it('invalidate забывает прочитанное', async () => {
    const { remote, reads } = createRemote()
    const caching = createCachingNotesRemote(remote, { now: () => 0 })

    await caching.readManifest()
    await caching.readShard('2026-11')
    caching.invalidate()
    await caching.readManifest()
    await caching.readShard('2026-11')

    expect(reads).toEqual({ manifest: 2, shard: 2 })
  })

  it('запись обновляет кэш: следующее чтение не идёт на Диск', async () => {
    const { remote, reads, writes } = createRemote()
    const caching = createCachingNotesRemote(remote, { now: () => 0 })

    await caching.writeManifest(manifest('Новое имя'))
    const read = await caching.readManifest()

    expect(read?.notes[0]?.name).toBe('Новое имя')
    expect(reads.manifest).toBe(0)
    expect(writes.manifest).toBe(1)
  })

  it('запись шарда обновляет кэш шарда', async () => {
    const { remote, reads } = createRemote()
    const caching = createCachingNotesRemote(remote, { now: () => 0 })
    const next = { ...shard('2026-11'), updatedAt: '2026-11-16T12:00:00.000Z' }

    await caching.writeShard('2026-11', next)
    const read = await caching.readShard('2026-11')

    expect(read?.updatedAt).toBe('2026-11-16T12:00:00.000Z')
    expect(reads.shard).toBe(0)
  })

  it('ошибка чтения не попадает в кэш', async () => {
    const failing: NotesRemote = {
      ...createRemote().remote,
      readManifest: async () => {
        throw new Error('network down')
      },
    }
    const caching = createCachingNotesRemote(failing, { now: () => 0 })

    await expect(caching.readManifest()).rejects.toThrow('network down')
    // Следующий вызов снова пробует Диск, а не отдаёт пустоту из кэша.
    await expect(caching.readManifest()).rejects.toThrow('network down')
  })

  it('иконки кэш не трогает', async () => {
    const { remote } = createRemote()
    const caching = createCachingNotesRemote(remote, { now: () => 0 })

    expect(caching.readIcon).toBe(remote.readIcon)
    expect(caching.writeIcon).toBe(remote.writeIcon)
  })
})
