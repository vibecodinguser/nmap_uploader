import { defineContentScript } from 'wxt/utils/define-content-script'
import {
  installFetchAndXhrInterceptor,
  NSPD_INTERCEPTOR_SOURCE,
} from '@/lib/nspd/network_interceptor'

export default defineContentScript({
  matches: ['https://nspd.gov.ru/*', 'https://*.nspd.gov.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',
  allFrames: true,

  main() {
    installFetchAndXhrInterceptor((data: unknown) => {
      try {
        window.postMessage({ source: NSPD_INTERCEPTOR_SOURCE, data }, '*')
      } catch {}
    })
  },
})
