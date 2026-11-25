import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { createMapBridge } from '@/lib/map_bridge'
import { SETTINGS_POPUP_ID } from '@/lib/settings_popup/protocol'

/**
 * Мост между background и картой: центрирование, дата трекера, выбор точки.
 *
 * Отдельно от попапа настроек, потому что эти сообщения нужны и при закрытых
 * настройках: дату трекера ставит поле в панели, точку выбирает рисование
 * заметок, а карту центрирует список заметок.
 */
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    const bridge = createMapBridge({
      onTrackerDateChange: (date) => {
        // Дату получает только панель настроек: заметки живут по собственной
        // дате объекта и от трекера больше не зависят.
        const frame = document.querySelector<HTMLIFrameElement>(`#${SETTINGS_POPUP_ID} iframe`)
        frame?.contentWindow?.postMessage(
          { action: 'TRACKER_DATE_CHANGED', date },
          new URL(browser.runtime.getURL('/')).origin,
        )
      },
    })

    browser.runtime.onMessage.addListener(bridge.handleRuntimeMessage)

    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(bridge.handleRuntimeMessage)
      bridge.dispose()
    })
  },
})
