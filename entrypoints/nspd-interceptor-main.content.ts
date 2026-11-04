import { defineContentScript } from 'wxt/utils/define-content-script'
import { NSPD_INTERCEPTOR_SCRIPT } from '@/lib/nspd/content_script_descriptors'
import {
  installFetchAndXhrInterceptor,
  NSPD_INTERCEPTOR_SOURCE,
} from '@/lib/nspd/network_interceptor'

export default defineContentScript({
  matches: [...NSPD_INTERCEPTOR_SCRIPT.matches],
  runAt: NSPD_INTERCEPTOR_SCRIPT.runAt,
  world: NSPD_INTERCEPTOR_SCRIPT.world,
  allFrames: NSPD_INTERCEPTOR_SCRIPT.allFrames,
  // Регистрируется в рантайме: доступ к nspd.gov.ru необязательный (см. ADR 0005).
  registration: 'runtime',

  main() {
    installFetchAndXhrInterceptor((data: unknown) => {
      try {
        window.postMessage({ source: NSPD_INTERCEPTOR_SOURCE, data }, '*')
      } catch {}
    })
  },
})
