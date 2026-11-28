import { browser } from 'wxt/browser'
import type { MessageHandler } from '@/lib/background/message_router'
import { relayMessageToMapTabs } from '@/lib/background/relay_sender'
import { logBackgroundTaskFailure } from '@/lib/background/tasks'
import { isTrustedNmapsContentSender, logRejectedMessage } from '@/lib/message_auth'
import {
  GET_YANDEX_PERMISSIONS_ACTION,
  YANDEX_PERMISSIONS_CHANGED_ACTION,
} from '@/lib/notes_permission/protocol'
import { hasYandexPermissions } from '@/lib/yandex/permissions'

/**
 * Состояние разрешений Яндекса для контент-скрипта кнопки заметок.
 *
 * `permissions.contains` в контент-скрипте недоступен, поэтому оверлей над
 * кнопкой существует только тогда, когда разрешений нет, а узнать об этом
 * можно лишь в фоне.
 */
export const handleGetYandexPermissions: MessageHandler = (_message, sender, sendResponse) => {
  if (!isTrustedNmapsContentSender(sender)) {
    logRejectedMessage(GET_YANDEX_PERMISSIONS_ACTION, sender)
    sendResponse({ granted: false })
    return true
  }

  hasYandexPermissions()
    .then((granted) => sendResponse({ granted }))
    .catch(() => sendResponse({ granted: false }))
  return true
}

/**
 * Сообщает вкладкам карты, что набор разрешений Яндекса изменился.
 *
 * Достаточно один раз подписаться в фоне: выдача может прийти из тумблера
 * настроек, из панели или из оверлея над кнопкой, а контент-скрипт должен
 * снять оверлей (или вернуть его после отзыва доступа) без перезагрузки.
 */
export const broadcastYandexPermissions = async (): Promise<void> => {
  const granted = await hasYandexPermissions()
  const message = { action: YANDEX_PERMISSIONS_CHANGED_ACTION, granted }
  // Панель заметок — страница расширения: до неё `tabs.sendMessage` не доходит,
  // а именно ей нужно снять состояние «Разрешить доступ» без перезагрузки.
  browser.runtime.sendMessage(message).catch(() => {})
  await relayMessageToMapTabs({}, message)
}

export const initYandexPermissionsBroadcast = (): void => {
  const handlePermissionsChanged = (): void => {
    broadcastYandexPermissions().catch((error: unknown) => {
      logBackgroundTaskFailure('yandex permissions broadcast', error)
    })
  }

  browser.permissions.onAdded.addListener(handlePermissionsChanged)
  browser.permissions.onRemoved.addListener(handlePermissionsChanged)
}
