import { defineContentScript } from 'wxt/utils/define-content-script'
import { createTranslator, type TranslateFn } from '@/lib/i18n'
import {
  isCounterResetTarget,
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
    let svgObserver: SvgPointCounterObserver | null = null

    const handleUserInteraction = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      if (isCounterResetTarget(target)) {
        lastMapInteractionTime = 0
        return
      }

      lastMapInteractionTime = Date.now()
      svgObserver?.checkSystemBanner()
    }

    document.addEventListener('pointerdown', handleUserInteraction, true)
    document.addEventListener('mousedown', handleUserInteraction, true)
    document.addEventListener('click', handleUserInteraction, true)
    document.addEventListener('keydown', handleUserInteraction, true)

    const getLastMapInteractionTime = () => lastMapInteractionTime

    svgObserver = new SvgPointCounterObserver({
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
