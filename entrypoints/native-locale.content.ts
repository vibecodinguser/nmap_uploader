import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import type { Locale } from '@/lib/i18n/locale.types'
import { NATIVE_LOCALE_MESSAGE } from '@/lib/locale_bridge'
import { observeNativeLocale, readNativeLocale } from '@/lib/native_locale'

const LOCALE_FRAME_PATHS = ['/panel.html', '/notes-panel.html', '/polygon-upload.html'] as const

const isLocaleFrame = (frame: HTMLIFrameElement, paths: readonly string[]): boolean => {
  const src = frame.src
  return paths.some((path) => src.startsWith(path))
}

/**
 * Передаёт язык нативного редактора в iframe'ы расширения.
 *
 * Они живут на другом origin и не видят `<html lang>` редактора, поэтому язык
 * приходится пересылать сообщением. Начальный язык хост также кладёт в URL
 * iframe, чтобы панель не мигала русским до `load`; сообщение по `load`
 * страхует случай, когда язык сменился между созданием iframe и загрузкой.
 */
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    const paths = LOCALE_FRAME_PATHS.map((path) => browser.runtime.getURL(path))

    const postLocale = (frame: HTMLIFrameElement, locale: Locale): void => {
      // `'*'` как у остальных сообщений хост → iframe: origin расширения в
      // `chrome-extension:` / `moz-extension:` через `URL.origin` даёт `null`.
      frame.contentWindow?.postMessage({ action: NATIVE_LOCALE_MESSAGE, locale }, '*')
    }

    const onFrameLoad = (event: Event): void => {
      if (!(event.target instanceof HTMLIFrameElement)) return
      if (isLocaleFrame(event.target, paths)) {
        postLocale(event.target, readNativeLocale())
      }
    }

    const broadcast = (locale: Locale): void => {
      for (const frame of document.querySelectorAll('iframe')) {
        if (!isLocaleFrame(frame, paths)) continue
        // Повторный addEventListener с тем же обработчиком — no-op, копии копить не будет.
        frame.addEventListener('load', onFrameLoad)
        postLocale(frame, locale)
      }
    }

    broadcast(readNativeLocale())
    const stopObserving = observeNativeLocale(broadcast)

    ctx.onInvalidated(() => {
      stopObserving()
    })
  },
})
