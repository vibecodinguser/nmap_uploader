import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { relayMessageToMapTabs } from '@/lib/background/relay_sender'
import { logBackgroundTaskFailure } from '@/lib/background/tasks'
import {
  isTrustedNmapsOrPanelSender,
  logRejectedMessage,
  type RuntimeMessageSender,
} from '@/lib/message_auth'
import { withHiddenIds } from '@/lib/notes/application/load'
import type { NotesData } from '@/lib/notes/protocol'
import { NOTES_RENDER_ACTION, NOTES_SNAPSHOT_ACTION } from '@/lib/notes/protocol'
import { createIndexedDbNotesCache } from '@/lib/notes/storage/cache'
import { readHiddenNoteIds } from '@/lib/notes/storage/hidden_ids'
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

export const createPorts = async (): Promise<NotesPorts | null> => {
  const auth = await getStoredAuth()
  if (!auth) return null
  return {
    remote: createDiskNotesRemote({ token: auth.token }),
    cache: createIndexedDbNotesCache(),
  }
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
