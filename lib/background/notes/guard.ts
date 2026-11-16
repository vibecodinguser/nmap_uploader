import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { relayMessageToMapTabs } from '@/lib/background/relay_sender'
import { logBackgroundTaskFailure } from '@/lib/background/tasks'
import {
  isTrustedNmapsOrPanelSender,
  logRejectedMessage,
  type RuntimeMessageSender,
} from '@/lib/message_auth'
import { forgetSnapshot, withHiddenIds } from '@/lib/notes/application/load'
import { pruneHiddenIds } from '@/lib/notes/model/visibility'
import type { NotesData } from '@/lib/notes/protocol'
import { NOTES_RENDER_ACTION, NOTES_SNAPSHOT_ACTION } from '@/lib/notes/protocol'
import { createIndexedDbNotesCache } from '@/lib/notes/storage/cache'
import { createCachingNotesRemote } from '@/lib/notes/storage/caching_remote'
import { readHiddenNoteIds, writeHiddenNoteIds } from '@/lib/notes/storage/hidden_ids'
import { createDiskNotesRemote } from '@/lib/notes/storage/remote'
import type { NotesPorts } from '@/lib/notes/storage/repository'
import { getStoredAuth } from '@/lib/yandex/client'

/**
 * Общая обвязка фоновых обработчиков заметок.
 *
 * Здесь только транспорт: проверка отправителя, порты хранилища и рассылка.
 * Правила (что считать валидным запросом, как сливать манифест) живут в
 * `lib/notes/**` и тестируются без `chrome.*`.
 */

/**
 * Порты и кэш чтений для текущего аккаунта.
 *
 * Кэш живёт между сообщениями: серия правок идёт без повторных чтений
 * манифеста и шарда. Смена аккаунта означает другой диск — кэш прошлого
 * пользователя не должен попасть в новый.
 */
let session: { token: string; invalidate: () => void; ports: NotesPorts } | null = null

/**
 * Забыть всё, что относится к заметкам прошлого аккаунта.
 *
 * Без этого после выхода и входа другим аккаунтом панель показывала бы чужой
 * снимок: он лежит и в памяти background, и в IndexedDB. Данные на Диске при
 * этом не трогаются — заметки нового пользователя просто читаются заново.
 */
export const resetNotesSession = async (): Promise<void> => {
  session?.invalidate()
  session = null
  forgetSnapshot()
  try {
    await createIndexedDbNotesCache().clear()
  } catch (error: unknown) {
    // Кэш — ускоритель: без очистки данные не потеряются, но следующий
    // запуск прочитает чужой снимок. Поэтому только логируем.
    logBackgroundTaskFailure('notes cache clear', error)
  }
}

export const createPorts = async (): Promise<NotesPorts | null> => {
  const auth = await getStoredAuth()
  if (!auth) {
    // Токен исчез между вызовами — сессия относится к прошлому аккаунту.
    if (session) await resetNotesSession()
    return null
  }
  if (session?.token === auth.token) return session.ports

  if (session) {
    // Другой токен — другой диск. Очистку делаем до новой сессии, чтобы
    // снимок прошлого пользователя не успел уехать в панель.
    await resetNotesSession()
  }

  const remote = createCachingNotesRemote(createDiskNotesRemote({ token: auth.token }))
  const ports: NotesPorts = { remote, cache: createIndexedDbNotesCache() }
  session = { token: auth.token, invalidate: remote.invalidate, ports }
  return ports
}

/**
 * Сброс кэша чтений.
 *
 * Нужен там, где смысл обращения — именно свежесть: явная загрузка снимка
 * панелью и любая ошибка записи (после неё непонятно, совпадает ли кэш с
 * Диском, поэтому прочитанное забывается).
 */
export const forgetNotesReads = (): void => {
  session?.invalidate()
}

/**
 * Рассылает снимок панели и карте.
 *
 * Панель получает `NOTES_SNAPSHOT` как широковещательное сообщение, карта —
 * команду перерисовки. Отсутствие получателей не ошибка: панель может быть
 * закрыта, а вкладок карты — ни одной. Ошибка рассылки тоже не ошибка
 * мутации: запись уже прошла, а снимок догонит следующая загрузка.
 */
export const broadcastSnapshot = async (data: NotesData): Promise<void> => {
  try {
    const snapshot = await withHiddenIds(data, readHiddenNoteIds)
    browser.runtime.sendMessage({ action: NOTES_SNAPSHOT_ACTION, snapshot }).catch(() => {})
    await relayMessageToMapTabs({}, { action: NOTES_RENDER_ACTION, snapshot }).catch(() => {})
  } catch (error: unknown) {
    logBackgroundTaskFailure('notes broadcast', error)
  }
}

/**
 * Пускает к обработчику только панель и вкладку Народной карты.
 *
 * `denied` различается по действиям: запросы с данными отвечают ошибкой,
 * ретрансляция выбора и рисования — просто `ok: false`, как раньше.
 */
export const guard =
  (
    action: string,
    handler: MessageHandler,
    denied: Record<string, unknown> = { ok: false, error: 'ACCESS_DENIED' },
  ): MessageHandler =>
  (message, sender: RuntimeMessageSender, sendResponse) => {
    if (!isTrustedNmapsOrPanelSender(sender)) {
      logRejectedMessage(action, sender)
      sendResponse(denied)
      return true
    }
    return handler(message, sender, sendResponse)
  }
