/**
 * Хранилище заметок в фоновом процессе.
 *
 * Background — единственное место, которое знает и Яндекс.Диск, и открытые
 * вкладки карты. Панель просит данные, карта получает готовый снимок для
 * отрисовки; напрямую они не общаются.
 */
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { relayMessageToMapTabs } from '@/lib/background/relay_sender'
import { runBackgroundTask } from '@/lib/background/tasks'
import { getErrorMessage } from '@/lib/errors'
import {
  isTrustedNmapsContentSender,
  isTrustedPanelSender,
  logRejectedMessage,
  type RuntimeMessageSender,
} from '@/lib/message_auth'
import {
  createDiskNotesRemote,
  createIndexedDbNotesCache,
  deleteGroup,
  deleteNote,
  loadCachedSnapshot,
  loadRemoteSnapshot,
  moveNoteToGroup,
  type Note,
  type NoteGeometry,
  type NotesData,
  type NotesPatch,
  type NotesSnapshot,
  normalizeGeometry,
  normalizeNote,
  readHiddenNoteIds,
  saveGroup,
  saveNote,
  writeHiddenNoteIds,
} from '@/lib/notes'
import { normalizeGroup } from '@/lib/notes/manifest'
import {
  isDrawableNoteKind,
  NOTES_DELETE_GROUP_ACTION,
  NOTES_DELETE_NOTE_ACTION,
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_HIDDEN_CHANGED_ACTION,
  NOTES_ICON_ALLOWED_TYPES,
  NOTES_ICON_MAX_BYTES,
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
import { isAllowedIconFileName } from '@/lib/notes/storage/paths'
import type { NotesPorts } from '@/lib/notes/storage/repository'
import { getStoredAuth } from '@/lib/yandex/client'

let lastSnapshot: NotesData | null = null

const createPorts = async (): Promise<NotesPorts | null> => {
  const auth = await getStoredAuth()
  if (!auth) return null
  return {
    remote: createDiskNotesRemote({ token: auth.token }),
    cache: createIndexedDbNotesCache(),
  }
}

const isTrustedNotesSender = (sender: RuntimeMessageSender): boolean =>
  isTrustedPanelSender(sender) || isTrustedNmapsContentSender(sender)

/**
 * Добавляет к состоянию хранилища локальные скрытые id.
 *
 * Скрытие живёт в `storage.local`, а не на Диске, поэтому читается при каждой
 * выдаче снимка, а не хранится вместе с манифестом.
 */
const withHidden = async (data: NotesData): Promise<NotesSnapshot> => ({
  ...data,
  hiddenIds: await readHiddenNoteIds(),
})

/**
 * Рассылает снимок панели и карте.
 *
 * Панель получает `NOTES_SNAPSHOT` как широковещательное сообщение, карта —
 * команду перерисовки. Отсутствие получателей не ошибка: панель может быть
 * закрыта, а вкладок карты — ни одной.
 */
const broadcastSnapshot = async (data: NotesData): Promise<void> => {
  const snapshot = await withHidden(data)

  browser.runtime.sendMessage({ action: NOTES_SNAPSHOT_ACTION, snapshot }).catch(() => {})

  await relayMessageToMapTabs({}, { action: NOTES_RENDER_ACTION, snapshot }).catch(() => {})
}

const mergeMutation = (patch: NotesPatch): NotesData => {
  const base = lastSnapshot
  return { manifest: patch.manifest, shards: { ...(base?.shards ?? {}), ...patch.shards } }
}

export const handleNotesLoad: MessageHandler = (_message, sender, sendResponse) => {
  if (!isTrustedNotesSender(sender)) {
    logRejectedMessage(NOTES_LOAD_ACTION, sender)
    sendResponse({ ok: false, error: 'ACCESS_DENIED' })
    return true
  }

  const task = (async () => {
    const ports = await createPorts()
    if (!ports) {
      // Диагностика: чаще всего это «панель открыта до входа в Яндекс».
      console.debug('[nmap_uploader notes] нет токена в storage, заметки недоступны')
      sendResponse({ ok: false, error: 'AUTH_REQUIRED' })
      return
    }

    const cached = lastSnapshot ?? (await loadCachedSnapshot(ports))
    if (cached) {
      sendResponse({ ok: true, snapshot: await withHidden(cached) })
    }

    try {
      const fresh = await loadRemoteSnapshot(ports)
      lastSnapshot = fresh
      await broadcastSnapshot(fresh)
      if (!cached) {
        sendResponse({ ok: true, snapshot: await withHidden(fresh) })
      }
    } catch (error: unknown) {
      if (!cached) {
        sendResponse({ ok: false, error: getErrorMessage(error, 'STORAGE_ERROR') })
      }
    }
  })()

  runBackgroundTask(task, NOTES_LOAD_ACTION)
  return true
}

const readNotePayload = (
  message: Record<string, unknown>,
): { note: Note; geometry: NoteGeometry } | null => {
  const note = normalizeNote(message.note)
  const geometry = normalizeGeometry(message.geometry)
  return note && geometry ? { note, geometry } : null
}

const mutationHandler = ({
  action,
  run,
}: {
  action: string
  run: (ports: NotesPorts, message: Record<string, unknown>) => Promise<NotesPatch>
}): MessageHandler => {
  return (message, sender, sendResponse) => {
    if (!isTrustedNotesSender(sender)) {
      logRejectedMessage(action, sender)
      sendResponse({ ok: false, error: 'ACCESS_DENIED' })
      return true
    }

    const task = (async () => {
      const ports = await createPorts()
      if (!ports) {
        sendResponse({ ok: false, error: 'AUTH_REQUIRED' })
        return
      }

      try {
        const result = await run(ports, message)
        const snapshot = mergeMutation(result)
        lastSnapshot = snapshot

        // Ответ уходит сразу: рассылка снимка панели и вкладкам карты не
        // должна задерживать интерфейс.
        sendResponse({ ok: true, patch: result })
        await broadcastSnapshot(snapshot)
      } catch (error: unknown) {
        sendResponse({ ok: false, error: getErrorMessage(error, 'STORAGE_ERROR') })
      }
    })()

    runBackgroundTask(task, action)
    return true
  }
}

export const handleNotesSaveNote = mutationHandler({
  action: NOTES_SAVE_NOTE_ACTION,
  run: async (ports, message) => {
    const payload = readNotePayload(message)
    if (!payload) {
      throw new Error('INVALID_PAYLOAD')
    }
    return saveNote({ ports, note: payload.note, geometry: payload.geometry })
  },
})

export const handleNotesDeleteNote = mutationHandler({
  action: NOTES_DELETE_NOTE_ACTION,
  run: async (ports, message) => {
    if (typeof message.noteId !== 'string') throw new Error('INVALID_PAYLOAD')
    const date = typeof message.date === 'string' ? message.date : undefined
    return deleteNote({ ports, noteId: message.noteId, date })
  },
})

export const handleNotesSaveGroup = mutationHandler({
  action: NOTES_SAVE_GROUP_ACTION,
  run: async (ports, message) => {
    const group = normalizeGroup(message.group)
    if (!group) throw new Error('INVALID_PAYLOAD')
    return saveGroup({ ports, group })
  },
})

export const handleNotesDeleteGroup = mutationHandler({
  action: NOTES_DELETE_GROUP_ACTION,
  run: async (ports, message) => {
    if (typeof message.groupId !== 'string') throw new Error('INVALID_PAYLOAD')
    const mode = message.mode === 'cascade' ? 'cascade' : 'keepNotes'
    return deleteGroup({ ports, groupId: message.groupId, mode })
  },
})

export const handleNotesMoveNote = mutationHandler({
  action: NOTES_MOVE_NOTE_ACTION,
  run: async (ports, message) => {
    if (typeof message.noteId !== 'string') throw new Error('INVALID_PAYLOAD')
    const groupId = typeof message.groupId === 'string' ? message.groupId : null
    return moveNoteToGroup({ ports, noteId: message.noteId, groupId })
  },
})

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export const handleNotesUploadIcon: MessageHandler = (message, sender, sendResponse) => {
  if (!isTrustedNotesSender(sender)) {
    logRejectedMessage(NOTES_UPLOAD_ICON_ACTION, sender)
    sendResponse({ ok: false, error: 'ACCESS_DENIED' })
    return true
  }

  const task = (async () => {
    const fileName = message.fileName
    const contentType = message.contentType
    const data = message.data

    if (
      typeof fileName !== 'string' ||
      !isAllowedIconFileName(fileName) ||
      typeof contentType !== 'string' ||
      !(NOTES_ICON_ALLOWED_TYPES as readonly string[]).includes(contentType) ||
      typeof data !== 'string'
    ) {
      sendResponse({ ok: false, error: 'INVALID_PAYLOAD' })
      return
    }

    const bytes = decodeBase64(data)
    if (bytes.byteLength > NOTES_ICON_MAX_BYTES) {
      sendResponse({ ok: false, error: 'ICON_TOO_LARGE' })
      return
    }

    const ports = await createPorts()
    if (!ports) {
      sendResponse({ ok: false, error: 'AUTH_REQUIRED' })
      return
    }

    try {
      await ports.remote.writeIcon(fileName, bytes, contentType)
      await ports.cache.writeIcon(fileName, { bytes, contentType })
      sendResponse({ ok: true, fileName })
    } catch (error: unknown) {
      sendResponse({ ok: false, error: getErrorMessage(error, 'STORAGE_ERROR') })
    }
  })()

  runBackgroundTask(task, NOTES_UPLOAD_ICON_ACTION)
  return true
}

/**
 * Выбор заметки на карте или в панели нужно разослать всем: панель
 * подсвечивает строку, карта — объект и кнопку «Редактировать».
 */
export const handleNotesSelect: MessageHandler = (message, sender, sendResponse) => {
  if (!isTrustedNotesSender(sender)) {
    logRejectedMessage(NOTES_SELECT_ACTION, sender)
    sendResponse({ ok: false })
    return true
  }

  const noteId = typeof message.noteId === 'string' ? message.noteId : null
  const relayMessage = { action: NOTES_SELECT_ACTION, noteId }

  const task = (async () => {
    browser.runtime.sendMessage(relayMessage).catch(() => {})
    await relayMessageToMapTabs(sender, relayMessage).catch(() => {})
    sendResponse({ ok: true })
  })()

  runBackgroundTask(task, NOTES_SELECT_ACTION)
  return true
}

/** Панель → карта: начать рисование выбранной фигуры. */
export const handleNotesStartDraw: MessageHandler = (message, sender, sendResponse) => {
  if (!isTrustedNotesSender(sender)) {
    logRejectedMessage(NOTES_START_DRAW_ACTION, sender)
    sendResponse({ ok: false })
    return true
  }

  const kind = message.kind
  if (!isDrawableNoteKind(kind)) {
    sendResponse({ ok: false, error: 'INVALID_PAYLOAD' })
    return true
  }

  const task = (async () => {
    await relayMessageToMapTabs(sender, { action: NOTES_START_DRAW_ACTION, kind }).catch(() => {})
    sendResponse({ ok: true })
  })()
  runBackgroundTask(task, NOTES_START_DRAW_ACTION)
  return true
}

/**
 * Карта → панель: фигура нарисована.
 *
 * Заметку создаёт панель: только она знает существующие названия (для
 * автоимени) и текущую группу.
 */
export const handleNotesDrawFinished: MessageHandler = (message, sender, sendResponse) => {
  if (!isTrustedNotesSender(sender)) {
    logRejectedMessage(NOTES_DRAW_FINISHED_ACTION, sender)
    sendResponse({ ok: false })
    return true
  }

  const kind = message.kind
  const coords = Array.isArray(message.coords) ? message.coords : null
  if (!isDrawableNoteKind(kind) || !coords) {
    sendResponse({ ok: false, error: 'INVALID_PAYLOAD' })
    return true
  }

  browser.runtime.sendMessage({ action: NOTES_DRAW_FINISHED_ACTION, kind, coords }).catch(() => {})
  sendResponse({ ok: true })
  return true
}

/** Скрытие — локальное состояние, но карта должна об этом узнать. */
export const handleNotesHiddenChanged: MessageHandler = (message, sender, sendResponse) => {
  if (!isTrustedNotesSender(sender)) {
    logRejectedMessage(NOTES_HIDDEN_CHANGED_ACTION, sender)
    sendResponse({ ok: false })
    return true
  }

  const hiddenIds = Array.isArray(message.hiddenIds)
    ? message.hiddenIds.filter((id): id is string => typeof id === 'string')
    : null
  if (!hiddenIds) {
    sendResponse({ ok: false, error: 'INVALID_PAYLOAD' })
    return true
  }

  const task = (async () => {
    await writeHiddenNoteIds(hiddenIds)
    await relayMessageToMapTabs(sender, {
      action: NOTES_VISIBILITY_ACTION,
      hiddenIds,
    }).catch(() => {})
    sendResponse({ ok: true })
  })()
  runBackgroundTask(task, NOTES_HIDDEN_CHANGED_ACTION)
  return true
}
