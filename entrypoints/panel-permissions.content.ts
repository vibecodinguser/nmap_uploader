import { browser } from 'wxt/browser'
import {
  handlePanelPermissionRequest,
  installPanelPermissionReceiver,
} from '@/lib/permissions/panel_receiver'
import { isTrustedPermissionSender } from '@/lib/permissions/trusted_sender'

/**
 * Контент-скрипт редактора — приёмник запросов разрешений от панелей.
 *
 * Зачем отдельный скрипт, если панель живёт в iframe редактора:
 * `permissions.request` должен вызываться из инициатора, у которого есть
 * доступ ко всем хостам из запроса. Инициатор панели — сайт карты, и доступа
 * к `cloud-api.yandex.net` у него нет, поэтому диалог открывает этот
 * контент-скрипт: он работает в контексте расширения и делит с вкладкой её
 * домены.
 *
 * Жест пользователя: `permissions.request` разрешён только внутри обработчика
 * события, поэтому вызов `request` идёт синхронно из обработчика `postMessage`
 * (см. `handlePanelPermissionRequest` в `lib/permissions/panel_receiver.ts`).
 */
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    const stopReceiver = installPanelPermissionReceiver()

    /**
     * Резервный канал для панели, открытой во вкладке (не в iframe карты):
     * `window.parent` там — она сама, и `postMessage` до этого скрипта не
     * дойдёт. `runtime.sendMessage` приходит сюда, если вкладка карты
     * открыта. Отвечаем только доверенным страницам расширения.
     */
    const handleRuntimeMessage = (
      message: Record<string, unknown>,
      sender: { id?: string; url?: string },
      sendResponse: (response: unknown) => void,
    ): boolean | undefined => {
      if (message.action !== 'yandexPermissionRequest') return undefined
      if (!isTrustedPermissionSender(sender)) return undefined
      void handlePanelPermissionRequest({
        source: 'yamapper:panel-permission-request',
        set: 'yandex',
        requestId: `runtime-${Date.now().toString(36)}`,
      }).then((response) => sendResponse({ granted: response.granted }))
      return true
    }

    browser.runtime.onMessage.addListener(handleRuntimeMessage)

    ctx.onInvalidated(() => {
      stopReceiver()
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
    })
  },
})
