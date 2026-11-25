// @vitest-environment happy-dom

/**
 * Заметки не должны переезжать между аккаунтами.
 *
 * Снимок живёт в двух местах — память background и IndexedDB. Если их не
 * сбросить при выходе или смене токена, панель после входа другим аккаунтом
 * покажет чужие заметки: и в списке, и на карте.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '@/lib/yandex/constants'
import { EXTENSION_ID, getURL } from '@/tests/setup/browser_mock'

const store = vi.hoisted(() => ({
  /** Файлы на «Диске» по токенам: у каждого аккаунта свои заметки. */
  files: new Map<string, Map<string, unknown>>(),
  reads: [] as string[],
  clearedCaches: 0,
}))

const createDiskRemote = ({ token }: { token: string }) => ({
  readManifest: async (): Promise<NotesManifest | null> => {
    store.reads.push(`manifest:${token}`)
    return (store.files.get(token)?.get('manifest') as NotesManifest | undefined) ?? null
  },
  writeManifest: async (manifest: NotesManifest): Promise<void> => {
    store.files.get(token)?.set('manifest', manifest)
  },
  readShard: async (shardId: string): Promise<GeometryShard | null> =>
    (store.files.get(token)?.get(`shard:${shardId}`) as GeometryShard | undefined) ?? null,
  writeShard: async (): Promise<void> => {},
  readIcon: async () => null,
  writeIcon: async () => {},
})

const createCache = () => ({
  readManifest: async (): Promise<NotesManifest | null> => null,
  writeManifest: async (): Promise<void> => {},
  readShard: async (): Promise<GeometryShard | null> => null,
  writeShard: async (): Promise<void> => {},
  readIcon: async () => null,
  writeIcon: async () => {},
  clear: async (): Promise<void> => {
    store.clearedCaches += 1
  },
})

vi.mock('@/lib/notes/storage/remote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notes/storage/remote')>()
  return {
    ...actual,
    createDiskNotesRemote: (options: { token: string }) => createDiskRemote(options),
  }
})

vi.mock('@/lib/notes/storage/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notes/storage/cache')>()
  return { ...actual, createIndexedDbNotesCache: () => createCache() }
})

vi.mock('@/lib/background/relay_sender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/background/relay_sender')>()
  return { ...actual, relayMessageToMapTabs: async () => {} }
})

const signIn = async (token: string) => {
  await browser.storage.local.set({
    [STORAGE_TOKEN_KEY]: token,
    [STORAGE_USER_KEY]: { login: token },
  })
}

const signOut = async () => {
  await browser.storage.local.remove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY])
}

/**
 * Свежий набор модулей на каждый тест.
 *
 * Сессия заметок и память о снимке живут в модульной области: без сброса
 * соседний тест начинал бы с чужим токеном.
 */
const loadModules = async () => {
  vi.resetModules()
  const handlers = await import('@/lib/background/notes_handlers')
  const guard = await import('@/lib/background/notes/guard')
  return { handleNotesLoad: handlers.handleNotesLoad, ...guard }
}

const panelSender = (): RuntimeMessageSender => ({
  id: EXTENSION_ID,
  url: getURL('/notes-panel.html'),
})

const loadSnapshot = async (handleNotesLoad: MessageHandler) => {
  const sendResponse = vi.fn()
  handleNotesLoad({ action: 'NOTES_LOAD' }, panelSender(), sendResponse)
  await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
  return sendResponse.mock.calls[0]?.[0] as {
    ok: boolean
    snapshot?: { manifest: NotesManifest }
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  store.files = new Map()
  store.reads = []
  store.clearedCaches = 0

  store.files.set(
    'token-a',
    new Map([
      [
        'manifest',
        {
          version: 1,
          updatedAt: '2026-11-16T10:00:00.000Z',
          groups: [],
          deletedNotes: [],
          notes: [
            {
              id: 'note-a',
              kind: 'Point',
              name: 'Заметка аккаунта A',
              description: '',
              date: '16-11-2026',
              icon: null,
              showLabel: false,
              style: { color: null, fillColor: null, hatch: null, opacity: 1, strokeWidth: 3 },
              groupId: null,
              createdAt: '2026-11-16T10:00:00.000Z',
              updatedAt: '2026-11-16T10:00:00.000Z',
            },
          ],
        } satisfies NotesManifest,
      ],
    ]),
  )
  store.files.set(
    'token-b',
    new Map([
      [
        'manifest',
        {
          version: 1,
          updatedAt: '2026-11-16T10:00:00.000Z',
          groups: [],
          deletedNotes: [],
          notes: [],
        } satisfies NotesManifest,
      ],
    ]),
  )

  vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async () => undefined) as never)
})

describe('смена аккаунта', () => {
  it('после входа другим аккаунтом панель не показывает чужие заметки', async () => {
    await signIn('token-a')
    const { handleNotesLoad } = await loadModules()

    const first = await loadSnapshot(handleNotesLoad)
    expect(first.snapshot?.manifest.notes.map((note) => note.id)).toEqual(['note-a'])

    await signIn('token-b')
    const second = await loadSnapshot(handleNotesLoad)

    expect(second.snapshot?.manifest.notes).toEqual([])
  })

  it('при смене токена кэш IndexedDB очищается', async () => {
    await signIn('token-a')
    const { createPorts } = await loadModules()

    const first = await createPorts()
    expect(first).not.toBeNull()

    await signIn('token-b')
    await createPorts()

    expect(store.clearedCaches).toBeGreaterThan(0)
  })

  it('повторный вызов с тем же токеном не сбрасывает сессию', async () => {
    await signIn('token-a')
    const { createPorts } = await loadModules()

    const first = await createPorts()
    const second = await createPorts()

    // Тот же объект портов: кэш чтений продолжает работать.
    expect(second.ok).toBe(true)
    expect(first.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('expected granted access')
    expect(second.ports).toBe(first.ports)
    expect(store.clearedCaches).toBe(0)
  })

  it('после выхода сессия и снимок забываются', async () => {
    await signIn('token-a')
    const { handleNotesLoad } = await loadModules()
    await loadSnapshot(handleNotesLoad)

    await signOut()
    const second = await loadSnapshot(handleNotesLoad)
    expect(second.ok).toBe(false)

    // Снова тот же аккаунт: снимок читается с Диска, а не из памяти.
    store.reads = []
    await signIn('token-a')
    const third = await loadSnapshot(handleNotesLoad)

    expect(store.reads).toContain('manifest:token-a')
    expect(third.snapshot?.manifest.notes.map((note) => note.id)).toEqual(['note-a'])
  })

  it('resetNotesSession очищает кэш и без активной сессии', async () => {
    const { resetNotesSession } = await loadModules()

    await resetNotesSession()

    expect(store.clearedCaches).toBeGreaterThan(0)
  })
})
