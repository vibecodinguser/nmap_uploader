import { defineContentScript } from 'wxt/utils/define-content-script'
import { createTranslator, type TranslateFn } from '@/lib/i18n'
import {
  PointCounterUi,
  patchCanvasForPointCounter,
  SvgPointCounterObserver,
} from '@/lib/point_counter'

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',
  world: 'MAIN',

  main() {
    const pageLang = document.documentElement.lang || navigator.language || 'ru'
    const locale = pageLang.toLowerCase().startsWith('en') ? 'en' : 'ru'
    const t: TranslateFn = createTranslator(locale)

    const ui = new PointCounterUi(() => t)
    ui.ensureCreated()

    let lastMapInteractionTime = 0

    document.addEventListener(
      'pointerdown',
      (e) => {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.closest('ymaps') ||
            target.tagName.toLowerCase() === 'canvas' ||
            target.tagName.toLowerCase() === 'svg')
        ) {
          lastMapInteractionTime = Date.now()
        }
      },
      true,
    )

    const getLastMapInteractionTime = () => lastMapInteractionTime

    const svgObserver = new SvgPointCounterObserver({
      ui,
      getLastMapInteractionTime,
    })
    svgObserver.start()

    window.addEventListener('message', (event) => {
      if (event.data?.action === 'RESET_POINT_COUNTER') {
        svgObserver.resetCounter()
        lastMapInteractionTime = 0
      }
    })

    patchCanvasForPointCounter({
      ui,
      getLastMapInteractionTime,
    })
  },
})
