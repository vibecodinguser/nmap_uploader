/**
 * Фоновые обработчики для интеграции с НСПД (загрузка GeoJSON и закрытие вкладки).
 */
import type { FeatureCollection } from 'geojson'
import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { processReloadEditor } from '@/lib/background/relay_sender'
import { openSettingsPopupOnTab } from '@/lib/background/settings_popup_injector'
import { runBackgroundTask } from '@/lib/background/tasks'
import { processGeoJsonData } from '@/lib/converters/geojson'
import { getBackgroundLocale } from '@/lib/i18n'
import {
  isTrustedNmapsContentSender,
  isTrustedNspdSender,
  isTrustedPanelSender,
  logRejectedMessage,
} from '@/lib/message_auth'
import { hasNspdHostAccess } from '@/lib/nspd/content_scripts'
import { resolveReloadAfterUploadPreference } from '@/lib/reload_after_upload'
import { uploadProcessedFilesToYandexDisk } from '@/lib/upload/yandex_upload'
import { resolveDiskAccess } from './disk_access'

export const UPLOAD_NSPD_GEOJSON_ACTION = 'UPLOAD_NSPD_GEOJSON'
export const CLOSE_CURRENT_TAB_ACTION = 'CLOSE_CURRENT_TAB'

export const processUploadNspdGeoJson = async (
  message: Record<string, unknown>,
  sendResponse: (res: { ok: boolean; error?: string }) => void,
): Promise<void> => {
  try {
    const access = await resolveDiskAccess()
    if (!access.ok) {
      sendResponse({ ok: false, error: access.error })
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
      locale: getBackgroundLocale(message),
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
    console.error('[yamapper] processUploadNspdGeoJson error:', err)
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
    console.error('[yamapper] processCloseCurrentTab error:', err)
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

/**
 * Открытие цели кнопки НСПД: сайт НСПД при выданном доступе или попап настроек
 * с подсветкой строки доступа, если его нет.
 *
 * Кнопку на карте рисует content script, а `chrome.permissions` в нём
 * недоступен (как и `tabs`). Поэтому решение и открытие вкладки/попапа
 * принимает background: он видит `permissions.contains` и умеет `tabs.create`.
 */
export const OPEN_NSPD_TARGET_ACTION = 'OPEN_NSPD_TARGET'

export const processOpenNspdTarget = async (
  message: Record<string, unknown>,
  sender: { tab?: { id?: number; url?: string } },
  sendResponse: (res: { ok: boolean; error?: string }) => void,
): Promise<void> => {
  try {
    const tabId = sender.tab?.id
    if (tabId === undefined) {
      sendResponse({ ok: false, error: 'NO_TAB' })
      return
    }

    if (await hasNspdHostAccess()) {
      const url = typeof message.url === 'string' && message.url ? message.url : null
      if (url) {
        await browser.tabs.create({ url, active: true })
      }
      sendResponse({ ok: true })
      return
    }

    // Доступа нет: кнопка на сайте НСПД всё равно не появится, поэтому
    // открываем настройки на строке «Разрешить доступ».
    await openSettingsPopupOnTab(tabId, sender.tab?.url, true)
    sendResponse({ ok: true })
  } catch (err: unknown) {
    console.error('[yamapper] processOpenNspdTarget error:', err)
    sendResponse({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

export const handleOpenNspdTarget: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNmapsContentSender(sender)) {
    const task = processOpenNspdTarget(message, sender, sendResponse)
    runBackgroundTask(task, OPEN_NSPD_TARGET_ACTION)
  } else {
    logRejectedMessage(OPEN_NSPD_TARGET_ACTION, sender)
    sendResponse({ ok: false, error: 'ACCESS_DENIED' })
  }
  return true
}
