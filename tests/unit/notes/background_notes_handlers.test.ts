// @vitest-environment happy-dom

/**
 * Characterization-тесты фоновых обработчиков заметок.
 *
 * Тесты фиксируют поведение `lib/background/notes_handlers.ts` на момент
 * рефакторинга, а не желаемое: у файла не было ни одного теста, и любая
 * перестановка кода могла молча изменить контракт панели, карты и Диска.
 *
 * Если ожидание нужно поменять — это осознанное изменение поведения, а не
 * подгонка теста. Известные дефекты отмечены отдельно.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import type { Note } from '@/lib/notes/model/types'
import type { NotesPatch } from '@/lib/notes/protocol'
import {
  NOTES_DELETE_GROUP_ACTION,
  NOTES_DELETE_NOTE_ACTION,
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_HIDDEN_CHANGED_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_MOVE_NOTE_ACTION,
  NOTES_RENDER_ACTION,
  NOTES_SAVE_GROUP_ACTION,
  NOTES_SAVE_NOTE_ACTION,
  NOTES_SELECT_ACTION,
  NOTES_SNAPSHOT_ACTION,
  NOTES_START_DRAW_ACTION,
  NOTES_UPLOAD_ICON_ACTION,
  NOTES_VISIBILITY_ACTION,
} from '@/lib/notes/protocol'
import { HIDDEN_NOTE_IDS_STORAGE_KEY } from '@/lib/notes/storage/hidden_ids'
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '@/lib/yandex/constants'
import { EXTENSION_ID, getURL } from '@/tests/setup/browser_mock'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

type MemoryFile = { bytes: Uint8Array; contentType: string }

/**
 * Общее состояние подменённого хранилища.
 *
 * `vi.hoisted` — потому что фабрики `vi.mock` поднимаются выше импортов и
 * должны видеть это состояние.
 */
const store = vi.hoisted(() => ({
  manifest: null as NotesManifest | null,
  shards: new Map<string, GeometryShard>(),
  icons: new Map<string, MemoryFile>(),
  writes: [] as string[],
  cacheManifest: null as NotesManifest | null,
  cacheShards: new Map<string, GeometryShard>(),
  cacheIcons: new Map<string, MemoryFile>(),
  relayed: [] as Array<{ sender: unknown; message: Record<string, unknown> }>,
  hub: [] as Array<Record<string, unknown>>,
}))

const createMemoryRemote = () => ({
  readManifest: async (): Promise<NotesManifest | null> => store.manifest,
  writeManifest: async (manifest: NotesManifest): Promise<void> => {
    store.manifest = manifest
    store.writes.push('manifest')
  },
  readShard: async (shardId: string): Promise<GeometryShard | null> =>
    store.shards.get(shardId) ?? null,
  writeShard: async (shardId: string, shard: GeometryShard): Promise<void> => {
    store.shards.set(shardId, shard)
    store.writes.push(`shard:${shardId}`)
  },
  readIcon: async (fileName: string): Promise<Uint8Array | null> =>
    store.icons.get(fileName)?.bytes ?? null,
  writeIcon: async (fileName: string, bytes: Uint8Array, contentType: string): Promise<void> => {
    store.icons.set(fileName, { bytes, contentType })
    store.writes.push(`icon:${fileName}`)
  },
})

const createMemoryCache = () => ({
  readManifest: async (): Promise<NotesManifest | null> => store.cacheManifest,
  writeManifest: async (manifest: NotesManifest): Promise<void> => {
    store.cacheManifest = manifest
  },
  readShard: async (shardId: string): Promise<GeometryShard | null> =>
    store.cacheShards.get(shardId) ?? null,
  writeShard: async (shardId: string, shard: GeometryShard): Promise<void> => {
    store.cacheShards.set(shardId, shard)
  },
  readIcon: async (fileName: string): Promise<MemoryFile | null> =>
    store.cacheIcons.get(fileName) ?? null,
  writeIcon: async (fileName: string, icon: MemoryFile): Promise<void> => {
    store.cacheIcons.set(fileName, icon)
  },
  clear: async (): Promise<void> => {
    store.cacheManifest = null
    store.cacheShards.clear()
    store.cacheIcons.clear()
  },
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
  return {
    ...actual,
    relayMessageToMapTabs: async (sender: unknown, message: Record<string, unknown>) => {
      store.relayed.push({ sender, message })
    },
  }
})

/** Свежий модуль обработчиков: `lastSnapshot` живёт в модульной переменной. */
const loadHandlers = async () => {
  vi.resetModules()
  return import('@/lib/background/notes_handlers')
}

const panelSender = (): RuntimeMessageSender => ({
  id: EXTENSION_ID,
  url: getURL('/notes-panel.html'),
})
const mapTabSender = (): RuntimeMessageSender => ({
  id: EXTENSION_ID,
  tab: { id: 42, url: 'https://n.maps.yandex.ru/#!/objects/1' },
})
const foreignSender = (): RuntimeMessageSender => ({
  id: EXTENSION_ID,
  tab: { id: 43, url: 'https://nakarte.me/#m=10/55/37' },
})

const invoke = (
  handler: MessageHandler,
  message: Record<string, unknown>,
  sender: RuntimeMessageSender,
) => {
  const sendResponse = vi.fn()
  const handled = handler(message, sender, sendResponse)
  return { handled, sendResponse }
}

const responsesOf = (sendResponse: ReturnType<typeof vi.fn>): Array<Record<string, unknown>> =>
  sendResponse.mock.calls.map(([response]) => response as Record<string, unknown>)

const manifestWith = (notes: Note[], groups: NotesManifest['groups'] = []): NotesManifest => ({
  version: 1,
  updatedAt: '2026-11-14T10:00:00.000Z',
  groups,
  notes,
})

/** Порядок записи манифеста и шарда не гарантирован: файлы уходят параллельно. */
const writes = (): string[] => [...store.writes].sort()

const pointGeometry = { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] }

const shardWith = (notes: GeometryShard['notes']): GeometryShard => ({
  version: 1,
  updatedAt: '2026-11-14T10:00:00.000Z',
  notes,
})

const signIn = async () => {
  await browser.storage.local.set({
    [STORAGE_TOKEN_KEY]: 'token',
    [STORAGE_USER_KEY]: { login: 'tester' },
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  store.manifest = null
  store.shards.clear()
  store.icons.clear()
  store.writes = []
  store.cacheManifest = null
  store.cacheShards.clear()
  store.cacheIcons.clear()
  store.relayed = []
  store.hub = []

  vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (message: unknown) => {
    store.hub.push(message as Record<string, unknown>)
    return undefined
  }) as never)
})

describe('NOTES_LOAD', () => {
  it('без токена отвечает AUTH_REQUIRED и не читает Диск', async () => {
    const { handleNotesLoad } = await loadHandlers()
    const { handled, sendResponse } = invoke(
      handleNotesLoad,
      { action: NOTES_LOAD_ACTION },
      panelSender(),
    )

    expect(handled).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toEqual({ ok: false, error: 'AUTH_REQUIRED' })
    expect(store.writes).toEqual([])
  })

  it('отклоняет отправителя не из панели и не с карты', async () => {
    await signIn()
    const { handleNotesLoad } = await loadHandlers()
    const { sendResponse } = invoke(handleNotesLoad, { action: NOTES_LOAD_ACTION }, foreignSender())

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toEqual({ ok: false, error: 'ACCESS_DENIED' })
  })

  it('собирает снимок с Диска, кладёт его в кэш и рассылает панели и карте', async () => {
    await signIn()
    const note = sampleNote({ id: 'note-1', name: '14.11.2026 Точка' })
    store.manifest = manifestWith([note])
    store.shards.set('2026-11', shardWith({ 'note-1': pointGeometry }))

    const { handleNotesLoad } = await loadHandlers()
    const { sendResponse } = invoke(handleNotesLoad, { action: NOTES_LOAD_ACTION }, panelSender())

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const [snapshot] = responsesOf(sendResponse)
    expect(snapshot.ok).toBe(true)

    // Снимок догружается в кэш: панель сможет открыться до ответа Диска.
    expect(store.cacheManifest?.notes.map((item) => item.id)).toEqual(['note-1'])
    expect(store.cacheShards.get('2026-11')?.notes['note-1']).toEqual(pointGeometry)

    // Панель получает широковещательный снимок, карта — команду отрисовки.
    await vi.waitFor(() =>
      expect(store.relayed.map(({ message }) => message.action)).toContain(NOTES_RENDER_ACTION),
    )
    const hubSnapshot = store.hub.find((message) => message.action === NOTES_SNAPSHOT_ACTION) as {
      snapshot: { manifest: NotesManifest; hiddenIds: string[] }
    }
    expect(hubSnapshot.snapshot.manifest.notes.map((item) => item.id)).toEqual(['note-1'])
    expect(hubSnapshot.snapshot.hiddenIds).toEqual([])
  })

  it('кэш отвечает первым, Диск — широковещательно', async () => {
    await signIn()
    await browser.storage.local.set({ [HIDDEN_NOTE_IDS_STORAGE_KEY]: ['hidden-1'] })
    store.cacheManifest = manifestWith([sampleNote({ id: 'cached-note' })])
    store.cacheShards.set('2026-11', shardWith({ 'cached-note': pointGeometry }))
    store.manifest = manifestWith([sampleNote({ id: 'remote-note' })])
    store.shards.set('2026-11', shardWith({ 'remote-note': pointGeometry }))

    const { handleNotesLoad } = await loadHandlers()
    const { sendResponse } = invoke(handleNotesLoad, { action: NOTES_LOAD_ACTION }, panelSender())

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const [cached] = responsesOf(sendResponse)
    expect((cached.snapshot as { manifest: NotesManifest }).manifest.notes[0]?.id).toBe(
      'cached-note',
    )
    expect((cached.snapshot as { hiddenIds: string[] }).hiddenIds).toEqual(['hidden-1'])

    // Второй ответ не уходит: свежий снимок доезжает широковещательно.
    await vi.waitFor(() => {
      const hubSnapshot = store.hub.find((message) => message.action === NOTES_SNAPSHOT_ACTION) as {
        snapshot: { manifest: NotesManifest }
      }
      expect(hubSnapshot.snapshot.manifest.notes[0]?.id).toBe('remote-note')
    })
    expect(sendResponse).toHaveBeenCalledTimes(1)
  })

  it('повторная загрузка отвечает из памяти, не дожидаясь Диска', async () => {
    await signIn()
    store.manifest = manifestWith([sampleNote({ id: 'note-1' })])
    store.shards.set('2026-11', shardWith({ 'note-1': pointGeometry }))

    const { handleNotesLoad } = await loadHandlers()
    const first = invoke(handleNotesLoad, { action: NOTES_LOAD_ACTION }, panelSender())
    await vi.waitFor(() => expect(first.sendResponse).toHaveBeenCalledTimes(1))

    // Диск «опустел»: второй ответ всё равно несёт прошлый снимок.
    store.manifest = null
    store.shards.clear()

    const second = invoke(handleNotesLoad, { action: NOTES_LOAD_ACTION }, panelSender())
    await vi.waitFor(() => expect(second.sendResponse).toHaveBeenCalledTimes(1))
    const [snapshot] = responsesOf(second.sendResponse)
    expect((snapshot.snapshot as { manifest: NotesManifest }).manifest.notes[0]?.id).toBe('note-1')
  })
})

describe('мутации заметок', () => {
  it('NOTES_SAVE_NOTE пишет манифест и шард, отвечает и рассылает снимок', async () => {
    await signIn()
    const note = sampleNote({ id: 'note-1' })
    const { handleNotesSaveNote } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesSaveNote,
      { action: NOTES_SAVE_NOTE_ACTION, note, geometry: pointGeometry },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const [response] = responsesOf(sendResponse)
    expect(response.ok).toBe(true)
    expect((response.patch as NotesPatch).manifest.notes.map((item) => item.id)).toEqual(['note-1'])
    expect(writes()).toEqual(['manifest', 'shard:2026-11'])
    expect(store.shards.get('2026-11')?.notes['note-1']).toEqual(pointGeometry)

    await vi.waitFor(() => expect(store.relayed).not.toHaveLength(0))
    const render = store.relayed[0]?.message as {
      action: string
      snapshot: { hiddenIds: string[] }
    }
    expect(render.action).toBe(NOTES_RENDER_ACTION)
    expect(render.snapshot.hiddenIds).toEqual([])
  })

  it('NOTES_SAVE_NOTE с битой заметкой отвечает INVALID_PAYLOAD и ничего не пишет', async () => {
    await signIn()
    const { handleNotesSaveNote } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesSaveNote,
      { action: NOTES_SAVE_NOTE_ACTION, note: { id: 'broken' }, geometry: pointGeometry },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toEqual({ ok: false, error: 'INVALID_PAYLOAD' })
    expect(store.writes).toEqual([])
  })

  it('NOTES_DELETE_NOTE убирает заметку и геометрию', async () => {
    await signIn()
    store.manifest = manifestWith([sampleNote({ id: 'note-1' })])
    store.shards.set('2026-11', shardWith({ 'note-1': pointGeometry }))
    const { handleNotesDeleteNote } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesDeleteNote,
      { action: NOTES_DELETE_NOTE_ACTION, noteId: 'note-1', date: '14-11-2026' },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const [response] = responsesOf(sendResponse)
    expect((response.patch as NotesPatch).manifest.notes).toEqual([])
    expect(store.shards.get('2026-11')?.notes).toEqual({})
    expect(writes()).toEqual(['manifest', 'shard:2026-11'])
  })

  it('NOTES_MOVE_NOTE переносит заметку в группу', async () => {
    await signIn()
    store.manifest = manifestWith([sampleNote({ id: 'note-1' })], [sampleGroup()])
    const { handleNotesMoveNote } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesMoveNote,
      { action: NOTES_MOVE_NOTE_ACTION, noteId: 'note-1', groupId: 'group-1' },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const [response] = responsesOf(sendResponse)
    expect((response.patch as NotesPatch).manifest.notes[0]?.groupId).toBe('group-1')
  })
})

describe('группы', () => {
  it('NOTES_SAVE_GROUP сохраняет группу', async () => {
    await signIn()
    const { handleNotesSaveGroup } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesSaveGroup,
      { action: NOTES_SAVE_GROUP_ACTION, group: sampleGroup() },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const [response] = responsesOf(sendResponse)
    expect((response.patch as NotesPatch).manifest.groups).toEqual([
      expect.objectContaining({ id: 'group-1', name: 'Мосты' }),
    ])
  })

  it('NOTES_DELETE_GROUP без режима распускает группу и оставляет заметки в корне', async () => {
    await signIn()
    store.manifest = manifestWith(
      [sampleNote({ id: 'note-1', groupId: 'group-1' })],
      [sampleGroup()],
    )
    const { handleNotesDeleteGroup } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesDeleteGroup,
      { action: NOTES_DELETE_GROUP_ACTION, groupId: 'group-1' },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const [response] = responsesOf(sendResponse)
    expect((response.patch as NotesPatch).manifest.groups).toEqual([])
    expect((response.patch as NotesPatch).manifest.notes[0]?.groupId).toBeNull()
    // Геометрия не тронута: шард не переписывался.
    expect(writes()).toEqual(['manifest'])
  })

  it('NOTES_DELETE_GROUP с mode=cascade удаляет заметки и геометрию', async () => {
    await signIn()
    store.manifest = manifestWith(
      [sampleNote({ id: 'note-1', groupId: 'group-1' })],
      [sampleGroup()],
    )
    store.shards.set('2026-11', shardWith({ 'note-1': pointGeometry }))
    const { handleNotesDeleteGroup } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesDeleteGroup,
      { action: NOTES_DELETE_GROUP_ACTION, groupId: 'group-1', mode: 'cascade' },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const [response] = responsesOf(sendResponse)
    expect((response.patch as NotesPatch).manifest.notes).toEqual([])
    expect(store.shards.get('2026-11')?.notes).toEqual({})
  })
})

describe('иконки', () => {
  const iconName = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png'

  it('NOTES_UPLOAD_ICON пишет файл на Диск и в кэш', async () => {
    await signIn()
    const { handleNotesUploadIcon } = await loadHandlers()
    const data = btoa('icon-bytes')

    const { sendResponse } = invoke(
      handleNotesUploadIcon,
      { action: NOTES_UPLOAD_ICON_ACTION, fileName: iconName, contentType: 'image/png', data },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toEqual({ ok: true, fileName: iconName })
    expect(store.icons.get(iconName)?.contentType).toBe('image/png')
    expect(store.cacheIcons.get(iconName)?.bytes).toEqual(new TextEncoder().encode('icon-bytes'))
  })

  it('отклоняет имя файла вне схемы uuid и неподдерживаемый тип', async () => {
    await signIn()
    const { handleNotesUploadIcon } = await loadHandlers()
    const data = btoa('icon-bytes')

    const badName = invoke(
      handleNotesUploadIcon,
      { action: NOTES_UPLOAD_ICON_ACTION, fileName: '../evil.png', contentType: 'image/png', data },
      panelSender(),
    )
    await vi.waitFor(() => expect(badName.sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(badName.sendResponse)[0]).toEqual({ ok: false, error: 'INVALID_PAYLOAD' })

    const badType = invoke(
      handleNotesUploadIcon,
      {
        action: NOTES_UPLOAD_ICON_ACTION,
        fileName: iconName,
        contentType: 'image/gif',
        data,
      },
      panelSender(),
    )
    await vi.waitFor(() => expect(badType.sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(badType.sendResponse)[0]).toEqual({ ok: false, error: 'INVALID_PAYLOAD' })
    expect(store.writes).toEqual([])
  })

  it('отклоняет файл больше 64 КБ', async () => {
    await signIn()
    const { handleNotesUploadIcon } = await loadHandlers()
    const data = btoa('x'.repeat(64 * 1024 + 1))

    const { sendResponse } = invoke(
      handleNotesUploadIcon,
      { action: NOTES_UPLOAD_ICON_ACTION, fileName: iconName, contentType: 'image/png', data },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toEqual({ ok: false, error: 'ICON_TOO_LARGE' })
    expect(store.writes).toEqual([])
  })
})

describe('ретрансляция карте', () => {
  it('NOTES_SELECT рассылает выбор панели и вкладкам карты', async () => {
    await signIn()
    const { handleNotesSelect } = await loadHandlers()
    const sender = mapTabSender()

    const { sendResponse } = invoke(
      handleNotesSelect,
      { action: NOTES_SELECT_ACTION, noteId: 'note-1' },
      sender,
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(store.hub).toContainEqual({ action: NOTES_SELECT_ACTION, noteId: 'note-1' })
    expect(store.relayed).toEqual([
      { sender, message: { action: NOTES_SELECT_ACTION, noteId: 'note-1' } },
    ])
  })

  it('NOTES_START_DRAW требует известный вид фигуры', async () => {
    await signIn()
    const { handleNotesStartDraw } = await loadHandlers()

    const valid = invoke(
      handleNotesStartDraw,
      { action: NOTES_START_DRAW_ACTION, kind: 'Circle' },
      panelSender(),
    )
    await vi.waitFor(() => expect(valid.sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(valid.sendResponse)[0]).toEqual({ ok: true })
    expect(store.relayed[0]?.message).toEqual({ action: NOTES_START_DRAW_ACTION, kind: 'Circle' })

    const invalid = invoke(
      handleNotesStartDraw,
      { action: NOTES_START_DRAW_ACTION, kind: 'Blob' },
      panelSender(),
    )
    await vi.waitFor(() => expect(invalid.sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(invalid.sendResponse)[0]).toEqual({ ok: false, error: 'INVALID_PAYLOAD' })
    expect(store.relayed).toHaveLength(1)
  })

  it('NOTES_DRAW_FINISHED отдаёт фигуру панели через background', async () => {
    await signIn()
    const { handleNotesDrawFinished } = await loadHandlers()
    const coords = [
      [37.6, 55.7],
      [37.7, 55.8],
    ]

    const { sendResponse } = invoke(
      handleNotesDrawFinished,
      { action: NOTES_DRAW_FINISHED_ACTION, kind: 'Line', coords },
      mapTabSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(store.hub).toContainEqual({ action: NOTES_DRAW_FINISHED_ACTION, kind: 'Line', coords })
  })

  it('NOTES_DRAW_FINISHED без координат отвечает INVALID_PAYLOAD', async () => {
    await signIn()
    const { handleNotesDrawFinished } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesDrawFinished,
      { action: NOTES_DRAW_FINISHED_ACTION, kind: 'Line' },
      mapTabSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toEqual({ ok: false, error: 'INVALID_PAYLOAD' })
    expect(store.hub).toEqual([])
  })
})

describe('скрытие', () => {
  it('NOTES_HIDDEN_CHANGED сохраняет отфильтрованные id и перерисовывает карту', async () => {
    await signIn()
    const { handleNotesHiddenChanged } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesHiddenChanged,
      { action: NOTES_HIDDEN_CHANGED_ACTION, hiddenIds: ['note-1', 42, 'note-2'] },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toEqual({ ok: true })
    const stored = await browser.storage.local.get(HIDDEN_NOTE_IDS_STORAGE_KEY)
    expect(stored[HIDDEN_NOTE_IDS_STORAGE_KEY]).toEqual(['note-1', 'note-2'])
    expect(store.relayed[0]?.message).toEqual({
      action: NOTES_VISIBILITY_ACTION,
      hiddenIds: ['note-1', 'note-2'],
    })
  })

  it('NOTES_HIDDEN_CHANGED без массива отвечает INVALID_PAYLOAD', async () => {
    await signIn()
    const { handleNotesHiddenChanged } = await loadHandlers()

    const { sendResponse } = invoke(
      handleNotesHiddenChanged,
      { action: NOTES_HIDDEN_CHANGED_ACTION, hiddenIds: 'note-1' },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toEqual({ ok: false, error: 'INVALID_PAYLOAD' })
    expect(store.relayed).toEqual([])
  })
})

describe('надёжность рассылки', () => {
  it('сбой рассылки не порождает второй ответ на успешную мутацию', async () => {
    await signIn()
    const { handleNotesSaveNote } = await loadHandlers()
    const realGet = browser.storage.local.get.bind(browser.storage.local)

    // Рассылка читает скрытые id; ошибка чтения не должна превращать уже
    // успешную запись в отказ — иначе панель откатила бы сохранённую заметку.
    vi.spyOn(browser.storage.local, 'get').mockImplementation((async (keys?: unknown) => {
      if (keys === HIDDEN_NOTE_IDS_STORAGE_KEY) {
        throw new Error('storage down')
      }
      return realGet(keys as never)
    }) as never)

    const { sendResponse } = invoke(
      handleNotesSaveNote,
      {
        action: NOTES_SAVE_NOTE_ACTION,
        note: sampleNote({ id: 'note-1' }),
        geometry: pointGeometry,
      },
      panelSender(),
    )

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(responsesOf(sendResponse)[0]).toMatchObject({ ok: true })
    expect(store.writes).toContain('manifest')
  })
})
