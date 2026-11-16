import type { MessageHandler } from '@/lib/background/message_router'
import { runBackgroundTask } from '@/lib/background/tasks'
import { getErrorMessage } from '@/lib/errors'
import { parseIconUploadRequest } from '@/lib/notes/icons/request'
import { NOTES_UPLOAD_ICON_ACTION } from '@/lib/notes/protocol'
import { createPorts, guard } from './guard'

/**
 * Загрузка пользовательской иконки.
 *
 * Файл небольшой (до 64 КБ), поэтому идёт в сообщении в base64 и пишется и на
 * Диск, и в кэш: карте иконка нужна без обращения к сети.
 */
export const handleNotesUploadIcon: MessageHandler = guard(
  NOTES_UPLOAD_ICON_ACTION,
  (message, _sender, sendResponse) => {
    const task = (async () => {
      const parsed = parseIconUploadRequest(message)
      if (!parsed.ok) {
        sendResponse({ ok: false, error: parsed.error })
        return
      }

      const ports = await createPorts()
      if (!ports) {
        sendResponse({ ok: false, error: 'AUTH_REQUIRED' })
        return
      }

      const { fileName, contentType, bytes } = parsed.value
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
  },
)
