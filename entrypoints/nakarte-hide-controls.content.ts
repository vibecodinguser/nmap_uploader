import { defineContentScript } from 'wxt/utils/define-content-script'
import { disableNakarteControlsHiding, enableNakarteControlsHiding } from '@/lib/go_to_split_view'

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://nakarte.me/*'],
  runAt: 'document_start',
  allFrames: true,

  main(ctx) {
    // В обычной вкладке nakarte.me контролы нужны: прячем только в iframe.
    if (window.self === window.top) {
      return
    }

    enableNakarteControlsHiding()

    ctx.onInvalidated(disableNakarteControlsHiding)
  },
})
