import { describe, expect, it } from 'vitest'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import { createNoopNotesCache } from '@/lib/notes/storage/cache'
import type { NotesRemote } from '@/lib/notes/storage/remote'
import {
  deleteGroup,
  deleteNote,
  loadRemoteSnapshot,
  moveNoteToGroup,
  saveGroup,
  saveNote,
} from '@/lib/notes/storage/repository'

type MemoryRemote = NotesRemote & {
  files: Map<string, unknown>
  writes: string[]
}

const createMemoryRemote = (): MemoryRemote => {
  const files = new Map<string, unknown>()
  const writes: string[] = []

  return {
    files,
    writes,
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
}

const ports = (remote: NotesRemote) => ({ remote, cache: createNoopNotesCache() })

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Point',
  name: 'Точка',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: { color: '#1a8cff', fillColor: null, hatch: null, opacity: 1, strokeWidth: 3 },
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

const group = (overrides: Partial<NoteGroup> = {}): NoteGroup => ({
  id: 'group-1',
  name: 'Группа',
  color: '#5aa845',
  order: 0,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

describe('saveNote', () => {
  it('пишет манифест и шард месяца, а не все шарды', async () => {
    const remote = createMemoryRemote()

    await saveNote({
      ports: ports(remote),
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    expect(remote.writes).toEqual(['shard:2026-11', 'manifest'])
    const manifest = remote.files.get('manifest') as NotesManifest
    expect(manifest.notes).toHaveLength(1)
    const shard = remote.files.get('shard:2026-11') as GeometryShard
    expect(shard.notes['note-1']).toEqual({ kind: 'Point', coords: [37, 55] })
  })

  it('переносит геометрию между шардами при смене месяца даты', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    await saveNote({
      ports: notePorts,
      note: note({ date: '01-12-2026' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    const november = remote.files.get('shard:2026-11') as GeometryShard
    const december = remote.files.get('shard:2026-12') as GeometryShard
    expect(november.notes['note-1']).toBeUndefined()
    expect(december.notes['note-1']).toBeDefined()
  })

  it('обновляет запись, а не дублирует её', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    await saveNote({
      ports: notePorts,
      note: note({ name: 'Переименована' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    const manifest = remote.files.get('manifest') as NotesManifest
    expect(manifest.notes).toHaveLength(1)
    expect(manifest.notes[0].name).toBe('Переименована')
  })

  it('не воскрешает заметку, удалённую другим устройством', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    await deleteNote({ ports: notePorts, noteId: 'note-1' })

    const manifest = remote.files.get('manifest') as NotesManifest
    expect(manifest.notes).toHaveLength(0)
  })
})

describe('deleteNote', () => {
  it('удаляет запись и геометрию', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    const result = await deleteNote({ ports: notePorts, noteId: 'note-1' })

    expect(result.manifest.notes).toHaveLength(0)
    const shard = remote.files.get('shard:2026-11') as GeometryShard
    expect(shard.notes['note-1']).toBeUndefined()
  })

  it('молча ничего не делает для неизвестной заметки', async () => {
    const remote = createMemoryRemote()
    const result = await deleteNote({ ports: ports(remote), noteId: 'нет-такой' })

    expect(result.manifest.notes).toEqual([])
    expect(remote.writes).toEqual([])
  })
})

describe('группы', () => {
  it('сохраняет группу в манифест', async () => {
    const remote = createMemoryRemote()
    const result = await saveGroup({ ports: ports(remote), group: group() })

    expect(result.manifest.groups).toHaveLength(1)
  })

  it('переносит заметку в группу', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    await saveGroup({ ports: notePorts, group: group() })
    const result = await moveNoteToGroup({ ports: notePorts, noteId: 'note-1', groupId: 'group-1' })

    expect(result.manifest.notes[0].groupId).toBe('group-1')
  })

  it('при удалении группы с сохранением заметок переносит их в корень', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note({ groupId: 'group-1' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    await saveGroup({ ports: notePorts, group: group() })
    const result = await deleteGroup({ ports: notePorts, groupId: 'group-1', mode: 'keepNotes' })

    expect(result.manifest.groups).toHaveLength(0)
    expect(result.manifest.notes[0].groupId).toBeNull()
  })

  it('при каскадном удалении убирает и заметки, и геометрию', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note({ groupId: 'group-1' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    await saveGroup({ ports: notePorts, group: group() })
    const result = await deleteGroup({ ports: notePorts, groupId: 'group-1', mode: 'cascade' })

    expect(result.manifest.notes).toHaveLength(0)
    const shard = remote.files.get('shard:2026-11') as GeometryShard
    expect(shard.notes['note-1']).toBeUndefined()
  })
})

describe('loadRemoteSnapshot', () => {
  it('собирает заметки и геометрию всех месяцев', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note({ id: 'nov', date: '14-11-2026' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    await saveNote({
      ports: notePorts,
      note: note({ id: 'dec', date: '01-12-2026' }),
      geometry: { kind: 'Point', coords: [38, 56] },
    })

    const snapshot = await loadRemoteSnapshot(notePorts)
    expect(Object.keys(snapshot.shards).sort()).toEqual(['2026-11', '2026-12'])
    expect(snapshot.manifest.notes).toHaveLength(2)
  })
})

describe('запись проигравшей версии', () => {
  it('не пишет геометрию, если на Диске уже есть более свежая версия заметки', async () => {
    const remote = createMemoryRemote()
    remote.files.set('manifest', {
      version: 1,
      updatedAt: '2026-11-14T12:00:00.000Z',
      groups: [],
      notes: [note({ id: 'note-1', name: 'Серверная', updatedAt: '2026-11-14T12:00:00.000Z' })],
    })
    remote.files.set('shard:2026-11', {
      version: 1,
      updatedAt: '2026-11-14T12:00:00.000Z',
      notes: { 'note-1': { kind: 'Point', coords: [1, 2] } },
    })

    const result = await saveNote({
      ports: ports(remote),
      note: note({ id: 'note-1', name: 'Локальная', updatedAt: '2026-11-14T10:00:00.000Z' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    // Ничего не записано: манифест и так новее, а геометрия проигравшей версии
    // описывала бы объект, которого в манифесте нет.
    expect(remote.writes).toEqual([])
    expect(result.shards).toEqual({})
    expect(result.manifest.notes[0]?.name).toBe('Серверная')
    expect((remote.files.get('shard:2026-11') as GeometryShard).notes['note-1']).toEqual({
      kind: 'Point',
      coords: [1, 2],
    })
  })

  it('пишет геометрию, когда версия клиента новее', async () => {
    const remote = createMemoryRemote()
    remote.files.set('manifest', {
      version: 1,
      updatedAt: '2026-11-14T10:00:00.000Z',
      groups: [],
      notes: [note({ id: 'note-1', name: 'Старая', updatedAt: '2026-11-14T10:00:00.000Z' })],
    })

    const result = await saveNote({
      ports: ports(remote),
      note: note({ id: 'note-1', name: 'Новая', updatedAt: '2026-11-14T12:00:00.000Z' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    expect(result.manifest.notes[0]?.name).toBe('Новая')
    expect(remote.writes).toContain('shard:2026-11')
    expect((remote.files.get('shard:2026-11') as GeometryShard).notes['note-1']).toEqual({
      kind: 'Point',
      coords: [37, 55],
    })
  })
})

describe('сериализация записей', () => {
  it('параллельные сохранения не перемешивают записи одного шарда', async () => {
    const remote = createMemoryRemote()
    const order: string[] = []
    const originalWrite = remote.writeShard

    remote.writeShard = async (shardId, shard) => {
      order.push(`begin:${shardId}`)
      // Искусственная задержка: без очереди две записи шли бы внахлёст.
      await new Promise((resolve) => setTimeout(resolve, 5))
      await originalWrite(shardId, shard)
      order.push(`end:${shardId}`)
    }

    const notePorts = ports(remote)
    await Promise.all([
      saveNote({
        ports: notePorts,
        note: note({ id: 'a' }),
        geometry: { kind: 'Point', coords: [37, 55] },
      }),
      saveNote({
        ports: notePorts,
        note: note({ id: 'b' }),
        geometry: { kind: 'Point', coords: [38, 56] },
      }),
    ])

    // Каждая запись шарда завершается до начала следующей.
    for (let index = 0; index < order.length; index += 2) {
      expect(order[index].startsWith('begin:')).toBe(true)
      expect(order[index + 1].startsWith('end:')).toBe(true)
    }

    const manifest = remote.files.get('manifest') as NotesManifest
    expect(manifest.notes.map((item) => item.id).sort()).toEqual(['a', 'b'])
  })
})

describe('удаление: скорость', () => {
  it('читает манифест и шард параллельно, если передана дата заметки', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)
    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    const order: string[] = []
    const originalReadManifest = remote.readManifest
    const originalReadShard = remote.readShard

    remote.readManifest = async () => {
      order.push('manifest:start')
      await new Promise((resolve) => setTimeout(resolve, 15))
      const value = await originalReadManifest()
      order.push('manifest:end')
      return value
    }
    remote.readShard = async (shardId) => {
      order.push('shard:start')
      await new Promise((resolve) => setTimeout(resolve, 15))
      const value = await originalReadShard(shardId)
      order.push('shard:end')
      return value
    }

    await deleteNote({ ports: notePorts, noteId: 'note-1', date: '14-11-2026' })

    // Оба чтения стартуют до завершения любого из них.
    expect(order.slice(0, 2).sort()).toEqual(['manifest:start', 'shard:start'])
  })

  it('пишет манифест и шард параллельно', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)
    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    const order: string[] = []
    const originalWriteManifest = remote.writeManifest
    const originalWriteShard = remote.writeShard

    remote.writeManifest = async (manifest) => {
      order.push('manifest:start')
      await new Promise((resolve) => setTimeout(resolve, 15))
      await originalWriteManifest(manifest)
      order.push('manifest:end')
    }
    remote.writeShard = async (shardId, shard) => {
      order.push('shard:start')
      await new Promise((resolve) => setTimeout(resolve, 15))
      await originalWriteShard(shardId, shard)
      order.push('shard:end')
    }

    await deleteNote({ ports: notePorts, noteId: 'note-1', date: '14-11-2026' })

    expect(order.slice(0, 2).sort()).toEqual(['manifest:start', 'shard:start'])
  })

  it('без даты всё равно корректно находит шард по манифесту', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)
    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    const result = await deleteNote({ ports: notePorts, noteId: 'note-1' })

    expect(result.manifest.notes).toHaveLength(0)
    const shard = remote.files.get('shard:2026-11') as GeometryShard
    expect(shard.notes['note-1']).toBeUndefined()
  })

  it('удаляет геометрию из шарда, даже если дата в подсказке чужая', async () => {
    const remote = createMemoryRemote()
    const notePorts = ports(remote)
    await saveNote({
      ports: notePorts,
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    await deleteNote({ ports: notePorts, noteId: 'note-1', date: '01-01-2020' })

    const shard = remote.files.get('shard:2026-11') as GeometryShard
    expect(shard.notes['note-1']).toBeUndefined()
  })
})

describe('создание: скорость', () => {
  it('читает манифест и шард параллельно', async () => {
    const remote = createMemoryRemote()
    const order: string[] = []
    const originalReadManifest = remote.readManifest
    const originalReadShard = remote.readShard

    remote.readManifest = async () => {
      order.push('manifest:start')
      await new Promise((resolve) => setTimeout(resolve, 15))
      const value = await originalReadManifest()
      order.push('manifest:end')
      return value
    }
    remote.readShard = async (shardId) => {
      order.push('shard:start')
      await new Promise((resolve) => setTimeout(resolve, 15))
      const value = await originalReadShard(shardId)
      order.push('shard:end')
      return value
    }

    await saveNote({
      ports: ports(remote),
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    expect(order.slice(0, 2).sort()).toEqual(['manifest:start', 'shard:start'])
  })
})

describe('updatedAt клиента', () => {
  it('сохраняет метку времени из запроса, а не ставит свою', async () => {
    const remote = createMemoryRemote()
    const clientStamp = '2026-11-14T09:00:00.000Z'

    const result = await saveNote({
      ports: ports(remote),
      note: note({ updatedAt: clientStamp }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    expect(result.manifest.notes[0].updatedAt).toBe(clientStamp)
  })

  it('не затирает перенос в группу более старой правкой', async () => {
    // Сценарий: правка отправлена раньше переноса, но выполнена позже.
    const remote = createMemoryRemote()
    const notePorts = ports(remote)

    await saveNote({
      ports: notePorts,
      note: note({ updatedAt: '2026-11-14T10:00:00.000Z' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })
    await saveGroup({ ports: notePorts, group: group() })

    // Перенос в группу — метка времени позже правки.
    await moveNoteToGroup({
      ports: notePorts,
      noteId: 'note-1',
      groupId: 'group-1',
    })

    // Отложенная правка со СТАРОЙ меткой приходит после переноса.
    const result = await saveNote({
      ports: notePorts,
      note: note({
        groupId: null,
        updatedAt: '2026-11-14T09:00:00.000Z',
      }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    // Побеждает более свежая запись — перенос в группу сохранён.
    expect(result.manifest.notes[0].groupId).toBe('group-1')
  })

  it('ставит метку сама, если клиент прислал мусор', async () => {
    const remote = createMemoryRemote()
    const before = Date.now()

    const result = await saveNote({
      ports: ports(remote),
      note: note({ updatedAt: 'не дата' }),
      geometry: { kind: 'Point', coords: [37, 55] },
    })

    expect(Date.parse(result.manifest.notes[0].updatedAt)).toBeGreaterThanOrEqual(before - 1000)
  })
})
