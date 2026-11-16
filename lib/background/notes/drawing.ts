import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { relayMessageToMapTabs } from '@/lib/background/relay_sender'
import { runBackgroundTask } from '@/lib/background/tasks'
import {
  isDrawableNoteKind,
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_SELECT_ACTION,
  NOTES_START_DRAW_ACTION,
} from '@/lib/notes/protocol'
import { guard } from './guard'

/**
 * Выбор заметки и рисование.
 *
 * Это ретрансляция, а не изменение данных: background нужен лишь потому, что
 * iframe панели и вкладка карты не видят друг друга напрямую.
 */

export const handleNotesSelect: MessageHandler = guard(
  NOTES_SELECT_ACTION,
  (message, sender, sendResponse) => {
    const noteId = typeof message.noteId === 'string' ? message.noteId : null
    const relayMessage = { action: NOTES_SELECT_ACTION, noteId }

    const task = (async () => {
      browser.runtime.sendMessage(relayMessage).catch(() => {})
      await relayMessageToMapTabs(sender, relayMessage).catch(() => {})
      sendResponse({ ok: true })
    })()

    runBackgroundTask(task, NOTES_SELECT_ACTION)
    return true
  },
  { ok: false },
)

/** Панель → карта: начать рисование выбранной фигуры. */
export const handleNotesStartDraw: MessageHandler = guard(
  NOTES_START_DRAW_ACTION,
  (message, sender, sendResponse) => {
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
  },
  { ok: false },
)

/**
 * Карта → панель: фигура нарисована.
 *
 * Заметку создаёт панель: только она знает существующие названия (для
 * автоимени) и текущую группу.
 */
export const handleNotesDrawFinished: MessageHandler = guard(
  NOTES_DRAW_FINISHED_ACTION,
  (message, _sender, sendResponse) => {
    const kind = message.kind
    const coords = Array.isArray(message.coords) ? message.coords : null
    if (!isDrawableNoteKind(kind) || !coords) {
      sendResponse({ ok: false, error: 'INVALID_PAYLOAD' })
      return true
    }

    browser.runtime
      .sendMessage({ action: NOTES_DRAW_FINISHED_ACTION, kind, coords })
      .catch(() => {})
    sendResponse({ ok: true })
    return true
  },
  { ok: false },
)
