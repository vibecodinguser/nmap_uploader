import type { MessageHandler } from '@/lib/background/message_router'
import { runBackgroundTask } from '@/lib/background/tasks'
import { getErrorMessage } from '@/lib/errors'
import { applyPatch, currentSnapshot, rememberSnapshot } from '@/lib/notes/application/load'
import type { Parsed } from '@/lib/notes/application/requests'
import type { NotesPatch } from '@/lib/notes/protocol'
import type { NotesPorts } from '@/lib/notes/storage/repository'
import { broadcastSnapshot, createPorts, forgetNotesReads, guard } from './guard'

/**
 * Обработчик мутации: проверить отправителя, разобрать запрос, применить
 * изменение, ответить патчем и разослать снимок.
 *
 * Ответ уходит до рассылки: интерфейс не должен ждать вкладки карты. Рассылка
 * не может породить второй ответ — ошибки внутри неё гасятся в `guard`.
 */
export const mutationHandler = <T>({
  action,
  parse,
  run,
}: {
  action: string
  parse: (message: Record<string, unknown>) => Parsed<T>
  run: (ports: NotesPorts, request: T) => Promise<NotesPatch>
}): MessageHandler =>
  guard(action, (message, _sender, sendResponse) => {
    const task = (async () => {
      // Порты создаются до разбора: без входа в Яндекс ответ «нужна
      // авторизация» важнее любой ошибки в полезной нагрузке.
      const ports = await createPorts()
      if (!ports) {
        sendResponse({ ok: false, error: 'AUTH_REQUIRED' })
        return
      }

      const parsed = parse(message)
      if (!parsed.ok) {
        sendResponse({ ok: false, error: parsed.error })
        return
      }

      try {
        const patch = await run(ports, parsed.value)
        const data = applyPatch(currentSnapshot(), patch)
        rememberSnapshot(data)

        sendResponse({ ok: true, patch })
        await broadcastSnapshot(data)
      } catch (error: unknown) {
        // После ошибки нельзя быть уверенным, что кэш совпадает с Диском:
        // часть запросов могла пройти, часть — нет.
        forgetNotesReads()
        sendResponse({ ok: false, error: getErrorMessage(error, 'STORAGE_ERROR') })
      }
    })()

    runBackgroundTask(task, action)
    return true
  })
