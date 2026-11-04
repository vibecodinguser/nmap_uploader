import { defineContentScript } from 'wxt/utils/define-content-script'
import { NSPD_HOST_PATTERNS } from '@/lib/manifest/nspd_optional_hosts'
import {
  installFetchAndXhrInterceptor,
  NSPD_INTERCEPTOR_SOURCE,
} from '@/lib/nspd/network_interceptor'

export default defineContentScript({
  matches: [...NSPD_HOST_PATTERNS],
  runAt: 'document_start',
  world: 'MAIN',
  allFrames: true,
  // Регистрируется в рантайме (см. lib/nspd/content_scripts.ts): доступ к nspd.gov.ru
  // необязательный, иначе обновления расширения отключали бы его у пользователей.
  registration: 'runtime',

  main() {
    installFetchAndXhrInterceptor((data: unknown) => {
      try {
        window.postMessage({ source: NSPD_INTERCEPTOR_SOURCE, data }, '*')
      } catch {}
    })
  },
})
