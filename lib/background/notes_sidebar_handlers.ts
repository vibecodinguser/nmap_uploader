/**
 * Сохранение заметки, созданной в сайдбаре Народной карты.
 *
 * Создание живёт на странице карты, а загрузка — в background: страница не
 * получает доступа к общему каналу `uploadProcessedFiles`, только к одному
 * действию «сохранить заметку».
 */
import type { MessageHandler } from '@/lib/background/message_router'
import { processRelayToMapTabs } from '@/lib/background/relay_handlers'
import { runBackgroundTask } from '@/lib/background/tasks'
import { displayToIso } from '@/lib/date_format'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import { isTrustedNmapsContentSender, logRejectedMessage } from '@/lib/message_auth'
import { loadDrawMapObjectsForDate } from '@/lib/nmaps_draw_objects'
import { formatNoteTime } from '@/lib/notes'
import {
  isSidebarNotePayload,
  NOTES_SIDEBAR_UPLOAD_ACTION,
  type SidebarNotePayload,
} from '@/lib/notes_sidebar/upload_action'
import { createGeometryIndex } from '@/lib/point_uploader'
import { uploadProcessedFilesToYandexDisk } from '@/lib/upload/yandex_upload'
import { downloadIndexJson, getStoredAuth } from '@/lib/yandex/client'
import { setLastDrawMapObjects } from './map_objects_handlers'

type SidebarNoteResponse = {
  ok: boolean
  error?: 'ACCESS_DENIED' | 'INVALID_NOTE' | 'INVALID_DATE' | 'AUTH_REQUIRED' | 'UPLOAD_FAILED'
  logs?: Array<{ level: string; message: string }>
}

const uploadSidebarNote = async (
  note: SidebarNotePayload,
  sender: RuntimeMessageSender,
  sendResponse: (response: SidebarNoteResponse) => void,
): Promise<void> => {
  const isoDate = displayToIso(note.date)
  if (!isoDate) {
    sendResponse({ ok: false, error: 'INVALID_DATE' })
    return
  }

  const auth = await getStoredAuth()
  if (!auth) {
    sendResponse({ ok: false, error: 'AUTH_REQUIRED' })
    return
  }

  const result = {
    ...createGeometryIndex({
      coords: note.coords,
      geomType: note.geomType,
      description: note.name.trim(),
      note_time: formatNoteTime(new Date()),
      note_desc: note.desc.trim(),
    }),
    metadata: [] as string[],
  }

  const upload = await uploadProcessedFilesToYandexDisk({
    files: [{ name: 'manual-point', result }],
    targetDate: isoDate,
  })

  sendResponse({
    ok: upload.ok === true,
    error: upload.ok === true ? undefined : 'UPLOAD_FAILED',
    logs: upload.logs,
  })

  if (upload.ok !== true) return

  try {
    const detail = await loadDrawMapObjectsForDate({
      selectedDate: note.date,
      token: auth.token,
      downloadIndex: downloadIndexJson,
    })
    setLastDrawMapObjects(detail)
    await processRelayToMapTabs(
      sender,
      { action: 'DRAW_MAP_OBJECTS', ...detail },
      () => {},
      NOTES_SIDEBAR_UPLOAD_ACTION,
    )
  } catch (error: unknown) {
    console.warn('[nmap_uploader] notes sidebar redraw failed:', error)
  }
}

export const handleUploadNoteFromSidebar: MessageHandler = (message, sender, sendResponse) => {
  if (!isTrustedNmapsContentSender(sender)) {
    logRejectedMessage(NOTES_SIDEBAR_UPLOAD_ACTION, sender)
    sendResponse({ ok: false, error: 'ACCESS_DENIED' })
    return true
  }

  const note = message.note
  if (!isSidebarNotePayload(note)) {
    sendResponse({ ok: false, error: 'INVALID_NOTE' })
    return true
  }

  runBackgroundTask(uploadSidebarNote(note, sender, sendResponse), NOTES_SIDEBAR_UPLOAD_ACTION)
  return true
}
