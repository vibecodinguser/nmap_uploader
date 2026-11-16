import type { MessageHandler } from '@/lib/background/message_router'
import { runBackgroundTask } from '@/lib/background/tasks'
import { getErrorMessage } from '@/lib/errors'
import { planNotesLoad, rememberSnapshot, withHiddenIds } from '@/lib/notes/application/load'
import { NOTES_LOAD_ACTION } from '@/lib/notes/protocol'
import { readHiddenNoteIds } from '@/lib/notes/storage/hidden_ids'
import { broadcastSnapshot, createPorts, forgetNotesReads, guard } from './guard'

/**
 * Загрузка снимка: кэш отвечает сразу, Диск — широковещательно.
 *
 * Два ответа на один запрос здесь намеренны: панель открывается из кэша, а
 * свежий снимок с Диска приходит широковещательным сообщением. Второй ответ
 * уходит только если кэша не было вовсе.
 */
export const handleNotesLoad: MessageHandler = guard(
  NOTES_LOAD_ACTION,
  (_message, _sender, sendResponse) => {
    const task = (async () => {
      const ports = await createPorts()
      if (!ports) {
        // Диагностика: чаще всего это «панель открыта до входа в Яндекс».
        console.debug('[nmap_uploader notes] нет токена в storage, заметки недоступны')
        sendResponse({ ok: false, error: 'AUTH_REQUIRED' })
        return
      }

      // Явная загрузка означает «покажи, что сейчас на Диске»: прочитанное
      // для прошлых правок больше не годится как источник истины.
      forgetNotesReads()
      const plan = await planNotesLoad(ports)
      if (plan.cached) {
        sendResponse({ ok: true, snapshot: await withHiddenIds(plan.cached, readHiddenNoteIds) })
      }

      try {
        const fresh = await plan.fresh()
        rememberSnapshot(fresh)
        await broadcastSnapshot(fresh)
        if (!plan.cached) {
          sendResponse({ ok: true, snapshot: await withHiddenIds(fresh, readHiddenNoteIds) })
        }
      } catch (error: unknown) {
        if (!plan.cached) {
          sendResponse({ ok: false, error: getErrorMessage(error, 'STORAGE_ERROR') })
        }
      }
    })()

    runBackgroundTask(task, NOTES_LOAD_ACTION)
    return true
  },
)
