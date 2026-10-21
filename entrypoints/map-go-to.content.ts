import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { GoToToolbarLifecycleManager } from '@/lib/go_to'

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    const lifecycle = new GoToToolbarLifecycleManager({
      storage: browser.storage,
      runtime: browser.runtime,
    })

    void lifecycle.start()

    ctx.onInvalidated(() => {
      lifecycle.stop()
    })
  },
})
