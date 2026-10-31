import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import {
  getStoredPointCounterEnabled,
  isPointCounterRequestMessage,
  POINT_COUNTER_ENABLED_STORAGE_KEY,
  POINT_COUNTER_STATE_MSG,
  setSystemBannerSuppressed,
} from '@/lib/point_counter'

const broadcastState = (enabled: boolean): void => {
  if (typeof window === 'undefined') return
  window.postMessage({ type: POINT_COUNTER_STATE_MSG, enabled }, '*')
}

const syncAndBroadcast = async (): Promise<void> => {
  try {
    const enabled = await getStoredPointCounterEnabled()
    setSystemBannerSuppressed(enabled)
    broadcastState(enabled)
  } catch (error: unknown) {
    console.warn('[nmap_uploader] sync point counter setting failed:', error)
  }
}

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',

  main(ctx) {
    void syncAndBroadcast()

    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !(POINT_COUNTER_ENABLED_STORAGE_KEY in changes)) return
      const nextValue = changes[POINT_COUNTER_ENABLED_STORAGE_KEY]?.newValue
      if (typeof nextValue === 'boolean') {
        setSystemBannerSuppressed(nextValue)
        broadcastState(nextValue)
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange)

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      if (isPointCounterRequestMessage(event.data)) {
        void syncAndBroadcast()
      }
    }

    window.addEventListener('message', handleWindowMessage)

    ctx.onInvalidated(() => {
      browser.storage.onChanged.removeListener(handleStorageChange)
      window.removeEventListener('message', handleWindowMessage)
    })
  },
})
