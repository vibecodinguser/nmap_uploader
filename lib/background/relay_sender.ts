import { browser } from 'wxt/browser'
import { collectMapTabIds, isMapTabUrl } from '@/lib/map_tab'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import { reloadMapEditorTabs } from '@/lib/reload_editor_page'

/**
 * Ретранслирует сообщение во вкладку-источник (если это вкладка Народной карты)
 * либо во все открытые вкладки редактора карты.
 */
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

/**
 * Оборачивает отправку сообщения в try/catch и логирование с возвратом ok статуса.
 */
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

/**
 * Перезагружает вкладку Народной карты с передачей ответа.
 */
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
