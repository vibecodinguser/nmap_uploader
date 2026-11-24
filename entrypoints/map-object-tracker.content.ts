import { defineContentScript } from 'wxt/utils/define-content-script'
import { syncLocaleFromStorage } from '@/lib/i18n'
import { installCsrfTokenListener } from '@/lib/object_tracker/csrf_token'
import { ObjectTrackerController } from '@/lib/object_tracker/tracker_controller'

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    const stopCsrfListener = installCsrfTokenListener()
    const controller = new ObjectTrackerController()

    // Пункт «Отслеживать» в нативном меню локализован: без синхронизации
    // рантайм-локаль осталась бы дефолтной.
    void syncLocaleFromStorage()

    controller.start().catch((error: unknown) => {
      console.warn('[yamapper] object tracker start failed:', error)
    })

    ctx.onInvalidated(() => {
      controller.stop()
      stopCsrfListener()
    })
  },
})
