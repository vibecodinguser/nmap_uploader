// @vitest-environment happy-dom

/**
 * Серия правок не перечитывает манифест с Диска.
 *
 * Одна правка — чтение манифеста, чтение шарда, запись манифеста, запись шарда.
 * Пока пользователь правит свойства подряд, первые два запроса каждый раз
 * возвращают одно и то же: именно их снимает кэш чтений в фоне.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import {
  NOTES_DELETE_NOTE_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_SAVE_NOTE_ACTION,
} from '@/lib/notes/protocol'
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '@/lib/yandex/constants'
import { EXTENSION_ID, getURL } from '@/tests/setup/browser_mock'
import { sampleNote } from '@/tests/unit/notes_panel/list_props'

const store = vi.hoisted(() => ({
  manifest: null as NotesManifest | null,
  shards: new Map<string, GeometryShard>(),
  reads: { manifest: 0, shard: 0 },
  writes: { manifest: 0, shard: 0 },
  failNextWrite: false,
}))

const createMemoryRemote = () => ({
  readManifest: async (): Promise<NotesManifest | null> => {
    store.reads.manifest += 1
    return store.manifest
  },
  writeManifest: async (manifest: NotesManifest): Promise<void> => {
    if (store.failNextWrite) {
      store.failNextWrite = false
      throw new Error('423 LOCKED')
    }
    store.writes.manifest += 1
    store.manifest = manifest
  },
  readShard: async (shardId: string): Promise<GeometryShard | null> => {
    store.reads.shard += 1
    return store.shards.get(shardId) ?? null
  },
  writeShard: async (shardId: string, shard: GeometryShard): Promise<void> => {
    store.writes.shard += 1
    store.shards.set(shardId, shard)
  },
  readIcon: async () => null,
  writeIcon: async () => {},
})

const createMemoryCache = () => ({
  readManifest: async () => null,
  writeManifest: async () => {},
  readShard: async () => null,
  writeShard: async () => {},
  readIcon: async () => null,
  writeIcon: async () => {},
  clear: async () => {},
})

vi.mock('@/lib/notes/storage/remote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notes/storage/remote')>()
  return { ...actual, createDiskNotesRemote: () => createMemoryRemote() }
})

vi.mock('@/lib/notes/storage/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notes/storage/cache')>()
  return { ...actual, createIndexedDbNotesCache: () => createMemoryCache() }
})

vi.mock('@/lib/background/relay_sender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/background/relay_sender')>()
  return { ...actual, relayMessageToMapTabs: async () => {} }
})

const loadHandlers = async () => {
  vi.resetModules()
  return import('@/lib/background/notes_handlers')
}

const panelSender = (): RuntimeMessageSender => ({
  id: EXTENSION_ID,
  url: getURL('/notes-panel.html'),
})

const call = async (handler: MessageHandler, message: Record<string, unknown>) => {
  const sendResponse = vi.fn()
  handler(message, panelSender(), sendResponse)
  await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
  return sendResponse.mock.calls[0]?.[0] as Record<string, unknown>
}

const point = { kind: 'Point' as const, coords: [37, 55] as [number, number] }
const movedPoint = { kind: 'Point' as const, coords: [38, 56] as [number, number] }

beforeEach(() => {
  vi.restoreAllMocks()
  store.manifest = {
    version: 1,
    updatedAt: '2026-11-16T10:00:00.000Z',
    groups: [],
    notes: [sampleNote({ id: 'note-1', name: 'Исходное', date: '16-11-2026' })],
  }
  store.shards.clear()
  store.shards.set('2026-11', {
    version: 1,
    updatedAt: '2026-11-16T10:00:00.000Z',
    notes: { 'note-1': point },
  })
  store.reads = { manifest: 0, shard: 0 }
  store.writes = { manifest: 0, shard: 0 }
  store.failNextWrite = false

  vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async () => undefined) as never)
})

const signIn = async () => {
  await browser.storage.local.set({
    [STORAGE_TOKEN_KEY]: 'token',
    [STORAGE_USER_KEY]: { login: 'tester' },
  })
}

describe('кэш чтений в фоне', () => {
  it('три правки подряд читают манифест один раз', async () => {
    await signIn()
    const { handleNotesLoad, handleNotesSaveNote } = await loadHandlers()
    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })
    store.reads = { manifest: 0, shard: 0 }

    for (const name of ['Первое', 'Второе', 'Третье']) {
      await call(handleNotesSaveNote, {
        action: NOTES_SAVE_NOTE_ACTION,
        note: sampleNote({ id: 'note-1', name, date: '16-11-2026' }),
        geometry: point,
      })
    }

    // Снимок уже загружен, поэтому манифест не читается ни разу: все три
    // правки берут его из кэша.
    expect(store.reads.manifest).toBe(0)
    // Геометрия не меняется — шард не переписывается ни разу.
    expect(store.writes.shard).toBe(0)
    expect(store.writes.manifest).toBe(3)
  })

  it('смена координат пишет шард, повторная правка того же шарда его не перечитывает', async () => {
    await signIn()
    const { handleNotesLoad, handleNotesSaveNote } = await loadHandlers()
    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })
    store.reads = { manifest: 0, shard: 0 }

    await call(handleNotesSaveNote, {
      action: NOTES_SAVE_NOTE_ACTION,
      note: sampleNote({ id: 'note-1', name: 'Сдвиг', date: '16-11-2026' }),
      geometry: movedPoint,
    })
    await call(handleNotesSaveNote, {
      action: NOTES_SAVE_NOTE_ACTION,
      note: sampleNote({ id: 'note-1', name: 'Сдвиг 2', date: '16-11-2026' }),
      geometry: movedPoint,
    })

    expect(store.writes.shard).toBe(1)
    // Шард прочитан при загрузке снимка и больше не читается: вторая правка
    // берёт его из кэша, куда попала собственная запись.
    expect(store.reads.shard).toBe(0)
    expect(store.reads.manifest).toBe(0)
  })

  it('явная загрузка снимка читает манифест заново', async () => {
    await signIn()
    const { handleNotesLoad } = await loadHandlers()

    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })
    const afterFirst = store.reads.manifest
    expect(afterFirst).toBeGreaterThan(0)

    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })

    // Загрузка — это запрос «что сейчас на Диске», кэш ей не указ.
    expect(store.reads.manifest).toBe(afterFirst * 2)
  })

  it('ошибка записи сбрасывает кэш: следующая правка читает манифест заново', async () => {
    await signIn()
    const { handleNotesLoad, handleNotesSaveNote } = await loadHandlers()
    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })
    store.reads = { manifest: 0, shard: 0 }

    store.failNextWrite = true

    const failed = vi.fn()
    handleNotesSaveNote(
      {
        action: NOTES_SAVE_NOTE_ACTION,
        note: sampleNote({ id: 'note-1', name: 'Сбой', date: '16-11-2026' }),
        geometry: point,
      },
      panelSender(),
      failed,
    )
    await vi.waitFor(() => expect(failed).toHaveBeenCalled())

    await call(handleNotesSaveNote, {
      action: NOTES_SAVE_NOTE_ACTION,
      note: sampleNote({ id: 'note-1', name: 'После сбоя', date: '16-11-2026' }),
      geometry: point,
    })

    // Кэш не пережил ошибку: следующая правка читает манифест заново.
    expect(store.reads.manifest).toBe(1)
  })

  it('удаление после правки пользуется тем же кэшем', async () => {
    await signIn()
    const { handleNotesLoad, handleNotesSaveNote, handleNotesDeleteNote } = await loadHandlers()
    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })
    store.reads = { manifest: 0, shard: 0 }

    await call(handleNotesSaveNote, {
      action: NOTES_SAVE_NOTE_ACTION,
      note: sampleNote({ id: 'note-1', name: 'Правка', date: '16-11-2026' }),
      geometry: point,
    })
    await call(handleNotesDeleteNote, {
      action: NOTES_DELETE_NOTE_ACTION,
      noteId: 'note-1',
      date: '16-11-2026',
    })

    expect(store.reads.manifest).toBe(0)
    expect(store.manifest?.notes).toEqual([])
  })
})
