import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { ensureStrokeRecolorEngine, teardownStrokeRecolorEngine } from '@/lib/stroke_recolor_engine'

const persistYandexBrowserFlag = async (): Promise<void> => {
  if (!/YaBrowser|Yowser|YaSearchBrowser/i.test(navigator.userAgent)) return
  await browser.storage.local.set({ is_yandex_browser: true })
}

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  allFrames: true,
  runAt: 'document_start',
  main(ctx) {
    void persistYandexBrowserFlag()
    ensureStrokeRecolorEngine()
    ctx.onInvalidated(teardownStrokeRecolorEngine)
  },
})
