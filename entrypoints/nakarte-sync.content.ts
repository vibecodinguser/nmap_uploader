import { defineContentScript } from 'wxt/utils/define-content-script'
import { NakarteSyncService } from '@/lib/go_to_split_view'

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://nakarte.me/*'],
  runAt: 'document_idle',
  allFrames: true,

  main(ctx) {
    if (window.self !== window.top) {
      const syncService = new NakarteSyncService()
      syncService.start()

      ctx.onInvalidated(() => {
        syncService.stop()
      })
    }
  },
})
