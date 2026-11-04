import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { NSPD_COLLECTOR_SCRIPT } from '@/lib/nspd/content_script_descriptors'
import { startNspdDomObserver } from '@/lib/nspd/dom_injector'
import { initNspdNetworkInterceptor } from '@/lib/nspd/network_interceptor'
import { getStoredNspdButtonEnabled, NSPD_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/nspd/nspd_button'

export default defineContentScript({
  matches: [...NSPD_COLLECTOR_SCRIPT.matches],
  runAt: NSPD_COLLECTOR_SCRIPT.runAt,
  allFrames: NSPD_COLLECTOR_SCRIPT.allFrames,
  world: NSPD_COLLECTOR_SCRIPT.world,
  // Регистрируется в рантайме: доступ к nspd.gov.ru необязательный (см. ADR 0005).
  registration: 'runtime',

  async main(ctx) {
    const stopInterceptor = initNspdNetworkInterceptor()
    let stopDomObserver: (() => void) | undefined

    const updateDomObserver = (enabled: boolean) => {
      if (enabled && !stopDomObserver) {
        stopDomObserver = startNspdDomObserver()
      } else if (!enabled && stopDomObserver) {
        stopDomObserver()
        stopDomObserver = undefined
      }
    }

    const initialEnabled = await getStoredNspdButtonEnabled()
    updateDomObserver(initialEnabled)

    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && NSPD_BUTTON_ENABLED_STORAGE_KEY in changes) {
        const nextValue = changes[NSPD_BUTTON_ENABLED_STORAGE_KEY]?.newValue
        if (typeof nextValue === 'boolean') {
          updateDomObserver(nextValue)
        }
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange)

    ctx.onInvalidated(() => {
      browser.storage.onChanged.removeListener(handleStorageChange)
      stopInterceptor()
      stopDomObserver?.()
    })
  },
})
