// @vitest-environment happy-dom

/**
 * Скрытые id не должны копиться после удаления заметок.
 *
 * Скрытие хранится в `storage.local` и живёт дольше самих заметок: удалённая
 * заметка оставляла свой id навсегда. Набор маленький, но он целиком уезжает
 * в каждом сообщении о снимке, а после сотен удалений это уже заметно.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import {
  NOTES_DELETE_GROUP_ACTION,
  NOTES_DELETE_NOTE_ACTION,
  NOTES_LOAD_ACTION,
} from '@/lib/notes/protocol'
import { HIDDEN_NOTE_IDS_STORAGE_KEY } from '@/lib/notes/storage/hidden_ids'
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '@/lib/yandex/constants'
import { EXTENSION_ID, getURL } from '@/tests/setup/browser_mock'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

const store = vi.hoisted(() => ({
  manifest: null as NotesManifest | null,
  shards: new Map<string, GeometryShard>(),
}))

const createDiskRemote = () => ({
  readManifest: async (): Promise<NotesManifest | null> => store.manifest,
  writeManifest: async (manifest: NotesManifest): Promise<void> => {
    store.manifest = manifest
  },
  readShard: async (shardId: string): Promise<GeometryShard | null> =>
    store.shards.get(shardId) ?? null,
  writeShard: async (shardId: string, shard: GeometryShard): Promise<void> => {
    store.shards.set(shardId, shard)
  },
  readIcon: async () => null,
  writeIcon: async () => {},
})

const createCache = () => ({
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
  return { ...actual, createDiskNotesRemote: () => createDiskRemote() }
})

vi.mock('@/lib/notes/storage/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notes/storage/cache')>()
  return { ...actual, createIndexedDbNotesCache: () => createCache() }
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

const hiddenIds = async (): Promise<string[]> => {
  const stored = await browser.storage.local.get(HIDDEN_NOTE_IDS_STORAGE_KEY)
  return (stored[HIDDEN_NOTE_IDS_STORAGE_KEY] as string[] | undefined) ?? []
}

const point = { kind: 'Point' as const, coords: [37, 55] as [number, number] }

beforeEach(async () => {
  vi.restoreAllMocks()
  store.manifest = {
    version: 1,
    updatedAt: '2026-11-16T10:00:00.000Z',
    groups: [sampleGroup()],
    deletedNotes: [],
    notes: [
      sampleNote({ id: 'note-1', name: 'Первая' }),
      sampleNote({ id: 'note-2', name: 'Вторая' }),
      sampleNote({ id: 'note-3', name: 'В группе', groupId: 'group-1' }),
    ],
  }
  store.shards = new Map([
    [
      '2026-11',
      {
        version: 1,
        updatedAt: '2026-11-16T10:00:00.000Z',
        notes: { 'note-1': point, 'note-2': point, 'note-3': point },
      },
    ],
  ])

  await browser.storage.local.set({
    [STORAGE_TOKEN_KEY]: 'token',
    [STORAGE_USER_KEY]: { login: 'tester' },
    [HIDDEN_NOTE_IDS_STORAGE_KEY]: ['note-1', 'note-2', 'note-3'],
  })

  vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async () => undefined) as never)
})

describe('скрытые id после удаления', () => {
  it('удаление заметки убирает её id из скрытых', async () => {
    const { handleNotesLoad, handleNotesDeleteNote } = await loadHandlers()
    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })

    await call(handleNotesDeleteNote, {
      action: NOTES_DELETE_NOTE_ACTION,
      noteId: 'note-2',
      date: '16-11-2026',
    })

    expect(await hiddenIds()).toEqual(['note-1', 'note-3'])
  })

  it('каскадное удаление группы убирает id её заметок', async () => {
    const { handleNotesLoad, handleNotesDeleteGroup } = await loadHandlers()
    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })

    await call(handleNotesDeleteGroup, {
      action: NOTES_DELETE_GROUP_ACTION,
      groupId: 'group-1',
      mode: 'cascade',
    })

    expect(await hiddenIds()).toEqual(['note-1', 'note-2'])
  })

  it('роспуск группы не трогает скрытие: заметки остаются', async () => {
    const { handleNotesLoad, handleNotesDeleteGroup } = await loadHandlers()
    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })

    await call(handleNotesDeleteGroup, {
      action: NOTES_DELETE_GROUP_ACTION,
      groupId: 'group-1',
      mode: 'keepNotes',
    })

    expect(await hiddenIds()).toEqual(['note-1', 'note-2', 'note-3'])
  })

  it('скрытые id, которых и не было в манифесте, снимаются при удалении', async () => {
    await browser.storage.local.set({
      [HIDDEN_NOTE_IDS_STORAGE_KEY]: ['note-1', 'deleted-long-ago'],
    })
    const { handleNotesLoad, handleNotesDeleteNote } = await loadHandlers()
    await call(handleNotesLoad, { action: NOTES_LOAD_ACTION })

    await call(handleNotesDeleteNote, {
      action: NOTES_DELETE_NOTE_ACTION,
      noteId: 'note-2',
      date: '16-11-2026',
    })

    expect(await hiddenIds()).toEqual(['note-1'])
  })
})
