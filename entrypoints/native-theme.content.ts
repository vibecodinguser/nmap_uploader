import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { observeNativeTheme, readNativeTheme } from '@/lib/native_theme'
import type { Theme } from '@/lib/theme'
import { NATIVE_THEME_MESSAGE } from '@/lib/theme_bridge'

const THEME_FRAME_PATHS = ['/panel.html', '/notes-panel.html', '/polygon-upload.html'] as const

const isThemeFrame = (frame: HTMLIFrameElement, paths: readonly string[]): boolean => {
  const src = frame.src
  return paths.some((path) => src.startsWith(path))
}

/**
 * Передаёт тему нативного редактора в iframe'ы расширения.
 *
 * Они живут на другом origin и не видят `.nk-page`, поэтому тему приходится
 * пересылать сообщением. Начальную тему хост также кладёт в URL iframe, чтобы
 * панель не мигала светлым до `load`; сообщение по `load` страхует случай,
 * когда тема сменилась между созданием iframe и его загрузкой.
 */
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    const paths = THEME_FRAME_PATHS.map((path) => browser.runtime.getURL(path))

    const postTheme = (frame: HTMLIFrameElement, theme: Theme): void => {
      // `'*'` как у остальных сообщений хост → iframe: origin расширения в
      // `chrome-extension:` / `moz-extension:` через `URL.origin` даёт `null`.
      frame.contentWindow?.postMessage({ action: NATIVE_THEME_MESSAGE, theme }, '*')
    }

    const onFrameLoad = (event: Event): void => {
      if (!(event.target instanceof HTMLIFrameElement)) return
      if (isThemeFrame(event.target, paths)) {
        postTheme(event.target, readNativeTheme())
      }
    }

    const broadcast = (theme: Theme): void => {
      for (const frame of document.querySelectorAll('iframe')) {
        if (!isThemeFrame(frame, paths)) continue
        // Повторный addEventListener с тем же обработчиком — no-op, копии копить не будет.
        frame.addEventListener('load', onFrameLoad)
        postTheme(frame, theme)
      }
    }

    broadcast(readNativeTheme())
    const stopObserving = observeNativeTheme(broadcast)

    ctx.onInvalidated(() => {
      stopObserving()
    })
  },
})
