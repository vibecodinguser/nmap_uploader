/**
 * Фоновые обработчики для интеграции с НСПД (загрузка GeoJSON и закрытие вкладки).
 */
import type { FeatureCollection } from 'geojson'
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { processReloadEditor } from '@/lib/background/relay_sender'
import { runBackgroundTask } from '@/lib/background/tasks'
import { processGeoJsonData } from '@/lib/converters/geojson'
import { isTrustedNspdSender, isTrustedPanelSender, logRejectedMessage } from '@/lib/message_auth'
import { resolveReloadAfterUploadPreference } from '@/lib/reload_after_upload'
import { uploadProcessedFilesToYandexDisk } from '@/lib/upload_service'
import { getStoredAuth } from '@/lib/yandex/client'

export const UPLOAD_NSPD_GEOJSON_ACTION = 'UPLOAD_NSPD_GEOJSON'
export const CLOSE_CURRENT_TAB_ACTION = 'CLOSE_CURRENT_TAB'

export const processUploadNspdGeoJson = async (
  message: Record<string, unknown>,
  sendResponse: (res: { ok: boolean; error?: string }) => void,
): Promise<void> => {
  try {
    const auth = await getStoredAuth()
    if (!auth?.user) {
      sendResponse({ ok: false, error: 'NOT_AUTHENTICATED' })
      return
    }

    const geojson = message.geojson as FeatureCollection | undefined
    if (geojson?.type !== 'FeatureCollection') {
      sendResponse({ ok: false, error: 'INVALID_GEOJSON' })
      return
    }

    const name = typeof message.name === 'string' && message.name ? message.name : 'nspd_object'
    const result = processGeoJsonData({ data: geojson, fileDesc: name })

    const uploadResult = await uploadProcessedFilesToYandexDisk({
      files: [{ name, result }],
    })

    if (!uploadResult.ok) {
      sendResponse({ ok: false, error: uploadResult.logs[0]?.message ?? 'UPLOAD_FAILED' })
      return
    }

    const shouldReload = await resolveReloadAfterUploadPreference()
    if (shouldReload) {
      const dummySender = { id: browser.runtime.id }
      await processReloadEditor(dummySender, () => {})
    }

    sendResponse({ ok: true })
  } catch (err: unknown) {
    console.error('[nmap_uploader] processUploadNspdGeoJson error:', err)
    sendResponse({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

export const handleUploadNspdGeoJson: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNspdSender(sender) || isTrustedPanelSender(sender)) {
    const task = processUploadNspdGeoJson(message, sendResponse)
    runBackgroundTask(task, UPLOAD_NSPD_GEOJSON_ACTION)
  } else {
    logRejectedMessage(UPLOAD_NSPD_GEOJSON_ACTION, sender)
    sendResponse({ ok: false, error: 'ACCESS_DENIED' })
  }
  return true
}

export const processCloseCurrentTab = async (
  sender: { tab?: { id?: number } },
  sendResponse: (res: { ok: boolean }) => void,
): Promise<void> => {
  try {
    const mapTabs = await browser.tabs.query({ url: '*://n.maps.yandex.ru/*' })
    if (mapTabs.length > 0 && mapTabs[0].id) {
      await browser.tabs.update(mapTabs[0].id, { active: true })
      if (mapTabs[0].windowId) {
        await browser.windows.update(mapTabs[0].windowId, { focused: true })
      }
    }

    if (sender.tab?.id) {
      await browser.tabs.remove(sender.tab.id)
    }

    sendResponse({ ok: true })
  } catch (err) {
    console.error('[nmap_uploader] processCloseCurrentTab error:', err)
    sendResponse({ ok: false })
  }
}

export const handleCloseCurrentTab: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNspdSender(sender) || isTrustedPanelSender(sender)) {
    const task = processCloseCurrentTab(sender, sendResponse)
    runBackgroundTask(task, CLOSE_CURRENT_TAB_ACTION)
  } else {
    logRejectedMessage(CLOSE_CURRENT_TAB_ACTION, sender)
    sendResponse({ ok: false })
  }
  return true
}
