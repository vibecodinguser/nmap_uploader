import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { FeedFilterLifecycleManager } from '@/lib/feeds_filter'

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    const lifecycle = new FeedFilterLifecycleManager({
      storage: browser.storage,
    })

    lifecycle.start().catch((error: unknown) => {
      console.warn('[nmap_uploader] FeedsFilter start failed:', error)
    })

    ctx.onInvalidated(() => {
      lifecycle.stop()
    })
  },
})
