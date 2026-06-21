import { defineContentScript } from 'wxt/utils/define-content-script'
import { isNmapsOrigin } from '@/lib/extension_origins'
import { applyNakarteLocationToPage, parseSetLocationMessage } from '@/lib/nakarte_location_apply'

const handleParentMessage = (event: MessageEvent): void => {
  if (event.source === window.parent && isNmapsOrigin(event.origin)) {
    const location = parseSetLocationMessage(event.data)
    if (location) {
      applyNakarteLocationToPage(location)
    }
  }
}

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://nakarte.me/*'],
  runAt: 'document_start',
  allFrames: true,
  world: 'MAIN',

  main() {
    if (window.self === window.top) {
      return
    }

    window.addEventListener('message', handleParentMessage)
  },
})
