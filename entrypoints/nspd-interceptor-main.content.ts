import { defineContentScript } from 'wxt/utils/define-content-script'
import { NSPD_INTERCEPTOR_SOURCE } from '@/lib/nspd/network_interceptor'

export default defineContentScript({
  matches: ['https://nspd.gov.ru/*', 'https://*.nspd.gov.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',
  allFrames: true,

  main() {
    const win = globalThis as unknown as Record<string, unknown>
    if (win.__nmapNspdInterceptorInjected) return
    win.__nmapNspdInterceptorInjected = true

    const postData = (data: unknown): void => {
      try {
        window.postMessage({ source: NSPD_INTERCEPTOR_SOURCE, data }, '*')
      } catch {}
    }

    const origFetch = window.fetch
    if (typeof origFetch === 'function') {
      window.fetch = async function (...args: Parameters<typeof origFetch>) {
        const res = await origFetch.apply(this, args)
        try {
          const clone = res.clone()
          clone
            .json()
            .then((json: unknown) => {
              if (json && typeof json === 'object') {
                postData(json)
              }
            })
            .catch(() => {})
        } catch {}
        return res
      }
    }

    const origOpen = XMLHttpRequest.prototype.open
    const origSend = XMLHttpRequest.prototype.send
    const xhrProto = XMLHttpRequest.prototype as unknown as { open: (...args: unknown[]) => void }
    xhrProto.open = function (...args: unknown[]) {
      return (origOpen as (...a: unknown[]) => void).apply(this, args)
    }
    XMLHttpRequest.prototype.send = function (...args: Parameters<typeof origSend>) {
      this.addEventListener('load', function () {
        try {
          if (this.responseText && (this.responseType === '' || this.responseType === 'text')) {
            const json = JSON.parse(this.responseText)
            if (json && typeof json === 'object') {
              postData(json)
            }
          }
        } catch {}
      })
      return origSend.apply(this, args)
    }
  },
})
