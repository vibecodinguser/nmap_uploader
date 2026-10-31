/**
 * Обработчики взаимодействия с Народной картой: трекерные даты и отображение векторных объектов.
 */
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { processRelayToMapTabs } from '@/lib/background/relay_handlers'
import { resolveClickedTab } from '@/lib/background/side_panel_service'
import { runBackgroundTask } from '@/lib/background/tasks'
import {
  isTrustedNmapsOrPanelSender,
  isTrustedPanelSender,
  logRejectedMessage,
} from '@/lib/message_auth'
import { type DrawMapObjectsDetail, loadDrawMapObjectsForDate } from '@/lib/nmaps_draw_objects'
import { extractTrackerDate } from '@/lib/notes/date_utils'
import { downloadIndexJson, getStoredAuth } from '@/lib/yandex/client'

let lastDrawMapObjects: DrawMapObjectsDetail | null = null

export const getLastDrawMapObjects = (): DrawMapObjectsDetail | null => lastDrawMapObjects

export const setLastDrawMapObjects = (value: DrawMapObjectsDetail | null): void => {
  lastDrawMapObjects = value
}

export const handleGetTrackerDate: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const processGetTrackerDate = async () => {
      const targetTab = await resolveClickedTab(sender.tab)
      if (targetTab?.id) {
        try {
          const injection = await browser.scripting.executeScript({
            target: { tabId: targetTab.id },
            func: () => {
              const el = document.querySelector(
                '.nk-map-layers-control-view__layer_id_tracker.nk-menu-item_checked',
              )
              if (el) {
                const btns = document.querySelectorAll('.nk-button__text')
                for (const btn of btns) {
                  const txt = btn.textContent?.trim() || ''
                  if (/\d{2}\.\d{2}\.\d{4}/.test(txt)) {
                    return txt
                  }
                }
              }
              return null
            },
          })
          const result = injection[0]?.result
          sendResponse({ date: result || null })
        } catch (error: unknown) {
          console.debug('[nmap_uploader] Failed to get tracker date:', error)
          sendResponse({ date: null })
        }
      } else {
        sendResponse({ date: null })
      }
    }
    const task = processGetTrackerDate()
    runBackgroundTask(task, 'getTrackerDate')
  } else {
    logRejectedMessage('getTrackerDate', sender)
    sendResponse({ date: null })
  }
  return true
}

export const handleDrawMapObjects: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = {
      action: 'DRAW_MAP_OBJECTS',
      points: message.points,
      snapTargets: Array.isArray(message.snapTargets) ? message.snapTargets : [],
    }
    lastDrawMapObjects = {
      points: Array.isArray(relayMessage.points) ? relayMessage.points : [],
      snapTargets: relayMessage.snapTargets,
    }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'DRAW_MAP_OBJECTS')
    runBackgroundTask(relayTask, 'DRAW_MAP_OBJECTS')
  } else {
    logRejectedMessage('DRAW_MAP_OBJECTS', sender)
    sendResponse({ ok: false })
  }
  return true
}

export const handleGetDrawMapObjects: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const loadDrawMapObjects = async () => {
      try {
        if (
          !lastDrawMapObjects ||
          (lastDrawMapObjects.points.length === 0 && lastDrawMapObjects.snapTargets.length === 0)
        ) {
          const [{ notes_selected_date: selectedDate }, auth] = await Promise.all([
            browser.storage.local.get('notes_selected_date'),
            getStoredAuth(),
          ])

          if (typeof selectedDate === 'string' && auth?.token) {
            lastDrawMapObjects = await loadDrawMapObjectsForDate({
              selectedDate,
              token: auth.token,
              downloadIndex: downloadIndexJson,
            })
          }
        }
      } finally {
        sendResponse(lastDrawMapObjects ?? { points: [], snapTargets: [] })
      }
    }
    runBackgroundTask(loadDrawMapObjects(), 'GET_DRAW_MAP_OBJECTS')
  } else {
    logRejectedMessage('GET_DRAW_MAP_OBJECTS', sender)
    sendResponse({ points: [], snapTargets: [] })
  }
  return true
}

export const handleTrackerDateChanged: MessageHandler = (message, sender) => {
  const rawDate = message.date as string | undefined
  const date = extractTrackerDate(rawDate)
  if (!date) return false

  const task = async () => {
    await browser.storage.local.set({ notes_selected_date: date })
    const auth = await getStoredAuth()
    if (!auth?.token) return

    const detail = await loadDrawMapObjectsForDate({
      selectedDate: date,
      token: auth.token,
      downloadIndex: downloadIndexJson,
    })
    lastDrawMapObjects = detail
    await processRelayToMapTabs(
      sender,
      {
        action: 'DRAW_MAP_OBJECTS',
        ...detail,
      },
      () => {},
      'TRACKER_DATE_CHANGED',
    )
  }

  runBackgroundTask(task(), 'TRACKER_DATE_CHANGED')
  return true
}
