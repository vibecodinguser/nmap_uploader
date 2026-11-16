import type { MessageHandler } from '@/lib/background/message_router'
import { relayMessageToMapTabs } from '@/lib/background/relay_sender'
import { runBackgroundTask } from '@/lib/background/tasks'
import { parseHiddenIds } from '@/lib/notes/application/requests'
import { NOTES_HIDDEN_CHANGED_ACTION, NOTES_VISIBILITY_ACTION } from '@/lib/notes/protocol'
import { writeHiddenNoteIds } from '@/lib/notes/storage/hidden_ids'
import { guard } from './guard'

/**
 * Скрытие заметок.
 *
 * Скрытие — локальное состояние «у меня сейчас», поэтому оно не идёт на Диск,
 * но карта должна узнать о нём сразу. Панель обновила снимок у себя сама.
 */
export const handleNotesHiddenChanged: MessageHandler = guard(
  NOTES_HIDDEN_CHANGED_ACTION,
  (message, sender, sendResponse) => {
    const parsed = parseHiddenIds(message)
    if (!parsed.ok) {
      sendResponse({ ok: false, error: parsed.error })
      return true
    }

    const hiddenIds = parsed.value
    const task = (async () => {
      await writeHiddenNoteIds(hiddenIds)
      await relayMessageToMapTabs(sender, { action: NOTES_VISIBILITY_ACTION, hiddenIds }).catch(
        () => {},
      )
      sendResponse({ ok: true })
    })()

    runBackgroundTask(task, NOTES_HIDDEN_CHANGED_ACTION)
    return true
  },
  { ok: false },
)
