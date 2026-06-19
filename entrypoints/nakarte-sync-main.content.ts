import { defineContentScript } from 'wxt/utils/define-content-script'
import { isNmapsOrigin } from '@/lib/extension_origins'
import { applyNakarteLocationToPage, parseSetLocationMessage } from '@/lib/nakarte_location_apply'

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://nakarte.me/*'],
  runAt: 'document_start',
  allFrames: true,
  world: 'MAIN',

  main() {
    if (window.self === window.top) return

    const handleParentMessage = (event: MessageEvent): void => {
      if (event.source !== window.parent) return
      if (!isNmapsOrigin(event.origin)) return

      const location = parseSetLocationMessage(event.data)
      if (!location) return

      applyNakarteLocationToPage(location)
    }

    window.addEventListener('message', handleParentMessage)
  },
})
