/**
 * Обработчики ретрансляции сообщений в открытые вкладки Народной карты.
 */
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { runBackgroundTask } from '@/lib/background/tasks'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import { collectMapTabIds, isMapTabUrl } from '@/lib/map_tab'
import {
  isTrustedNmapsOrPanelSender,
  logRejectedMessage,
  type RuntimeMessageSender,
} from '@/lib/message_auth'
import { CLOSE_PANEL_SIDEBAR_ACTION } from '@/lib/panel_sidebar_notify'
import { CANCEL_POINT_PICKING_ACTION, START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import { reloadMapEditorTabs } from '@/lib/reload_editor_page'

export const relayMessageToMapTabs = async (
  sender: RuntimeMessageSender,
  message: Record<string, unknown>,
): Promise<void> => {
  const senderTabId = sender.tab?.id
  if (senderTabId && isMapTabUrl(sender.tab?.url)) {
    await browser.tabs.sendMessage(senderTabId, message)
  } else {
    const tabIds = await collectMapTabIds()
    const sendRelayToTab = (tabId: number) => browser.tabs.sendMessage(tabId, message)
    const promises = tabIds.map(sendRelayToTab)
    await Promise.allSettled(promises)
  }
}

export const processRelayToMapTabs = async (
  sender: RuntimeMessageSender,
  relayMessage: Record<string, unknown>,
  sendResponse: (response: { ok: boolean }) => void,
  logLabel: string,
): Promise<void> => {
  try {
    await relayMessageToMapTabs(sender, relayMessage)
    sendResponse({ ok: true })
  } catch (error: unknown) {
    console.warn(`[nmap_uploader] ${logLabel} relay failed:`, error)
    sendResponse({ ok: false })
  }
}

export const processReloadEditor = async (
  sender: RuntimeMessageSender,
  sendResponse: (response: { ok: boolean }) => void,
): Promise<void> => {
  try {
    const ok = await reloadMapEditorTabs({ preferredTabId: sender.tab?.id })
    sendResponse({ ok })
  } catch (error: unknown) {
    console.warn('[nmap_uploader] reloadEditorPage failed:', error)
    sendResponse({ ok: false })
  }
}

export const handleReloadEditor: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const reloadTask = processReloadEditor(sender, sendResponse)
    runBackgroundTask(reloadTask, 'reloadEditorPage')
  } else {
    logRejectedMessage('reloadEditorPage', sender)
    sendResponse({ ok: false })
  }
  return true
}

export const handleGoToRefresh: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = { action: GO_TO_REFRESH_ACTION }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'refreshGoToMenu')
    runBackgroundTask(relayTask, GO_TO_REFRESH_ACTION)
  } else {
    logRejectedMessage(GO_TO_REFRESH_ACTION, sender)
    sendResponse({ ok: false })
  }
  return true
}

export const handleClosePanel: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = { action: CLOSE_PANEL_SIDEBAR_ACTION }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'closePanelSidebar')
    runBackgroundTask(relayTask, CLOSE_PANEL_SIDEBAR_ACTION)
  } else {
    logRejectedMessage(CLOSE_PANEL_SIDEBAR_ACTION, sender)
    sendResponse({ ok: false })
  }
  return true
}

export const handleStartPointPicking: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const geomType = typeof message.geomType === 'string' ? message.geomType : 'Point'
    const relayMessage = { action: START_POINT_PICKING_ACTION, geomType }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'startPointPicking')
    runBackgroundTask(relayTask, START_POINT_PICKING_ACTION)
  } else {
    logRejectedMessage(START_POINT_PICKING_ACTION, sender)
    sendResponse({ ok: false })
  }
  return true
}

export const handleCancelPointPicking: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = { action: CANCEL_POINT_PICKING_ACTION }
    const relayTask = processRelayToMapTabs(
      sender,
      relayMessage,
      sendResponse,
      'cancelPointPicking',
    )
    runBackgroundTask(relayTask, CANCEL_POINT_PICKING_ACTION)
  } else {
    logRejectedMessage(CANCEL_POINT_PICKING_ACTION, sender)
    sendResponse({ ok: false })
  }
  return true
}

export const handleApplyStrokeColor: MessageHandler = (message, sender, sendResponse) => {
  let color = ''
  if ('string' === typeof message.color) {
    color = message.color
  }
  const canRelay = color && isTrustedNmapsOrPanelSender(sender)

  if (canRelay) {
    const relayMessage = { action: 'applyStrokeColor', color }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'applyStrokeColor')
    runBackgroundTask(relayTask, 'applyStrokeColor')
  } else {
    if (color) {
      logRejectedMessage('applyStrokeColor', sender)
    }
    sendResponse({ ok: false })
  }
  return true
}

export const handleCenterMap: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = {
      action: 'centerMap',
      latitude: message.latitude,
      longitude: message.longitude,
      zoom: message.zoom,
      bbox: message.bbox,
    }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'centerMap')
    runBackgroundTask(relayTask, 'centerMap')
  } else {
    logRejectedMessage('centerMap', sender)
    sendResponse({ ok: false })
  }
  return true
}

export const handleSetTrackerDate: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = {
      action: 'SET_TRACKER_DATE',
      date: message.date,
    }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'SET_TRACKER_DATE')
    runBackgroundTask(relayTask, 'SET_TRACKER_DATE')
  } else {
    logRejectedMessage('SET_TRACKER_DATE', sender)
    sendResponse({ ok: false })
  }
  return true
}
