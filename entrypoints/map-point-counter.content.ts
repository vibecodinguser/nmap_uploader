import { defineContentScript } from 'wxt/utils/define-content-script'
import { createTranslator, type TranslateFn } from '@/lib/i18n'
import {
  isCounterResetTarget,
  isGeometryEditorActive,
  isPointCounterStateMessage,
  POINT_COUNTER_REQUEST_MSG,
  PointCounterUi,
  patchCanvasForPointCounter,
  resetCanvasPointCounter,
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
    let isCounterEnabled = true
    let svgObserver: SvgPointCounterObserver | null = null

    const handleUserInteraction = (e: Event) => {
      if (!isCounterEnabled) return

      const target = e.target as HTMLElement | null
      if (!target) return

      if (isCounterResetTarget(target)) {
        lastMapInteractionTime = 0
        svgObserver?.resetCounter()
        resetCanvasPointCounter()
        ui.hide()
        return
      }

      if (!isGeometryEditorActive()) {
        lastMapInteractionTime = 0
        svgObserver?.resetCounter()
        resetCanvasPointCounter()
        ui.hide()
        return
      }

      lastMapInteractionTime = Date.now()
      svgObserver?.checkSystemBanner(true)
    }

    document.addEventListener('pointerdown', handleUserInteraction, true)
    document.addEventListener('mousedown', handleUserInteraction, true)
    document.addEventListener('click', handleUserInteraction, true)
    document.addEventListener('keydown', handleUserInteraction, true)

    const getLastMapInteractionTime = () => lastMapInteractionTime
    const getIsCounterEnabled = () => isCounterEnabled

    svgObserver = new SvgPointCounterObserver({
      ui,
      getLastMapInteractionTime,
      isCounterEnabled: getIsCounterEnabled,
    })
    svgObserver.start()

    window.addEventListener('message', (event) => {
      if (event.data?.action === 'RESET_POINT_COUNTER') {
        svgObserver?.resetCounter()
        resetCanvasPointCounter()
        lastMapInteractionTime = 0
        return
      }

      if (isPointCounterStateMessage(event.data)) {
        const nextEnabled = event.data.enabled
        if (isCounterEnabled === nextEnabled) return

        isCounterEnabled = nextEnabled
        if (!isCounterEnabled) {
          svgObserver?.stop()
          resetCanvasPointCounter()
          ui.hide()
          lastMapInteractionTime = 0
        } else {
          svgObserver?.start()
        }
      }
    })

    window.postMessage({ type: POINT_COUNTER_REQUEST_MSG }, '*')

    patchCanvasForPointCounter({
      ui,
      getLastMapInteractionTime,
      isEnabled: getIsCounterEnabled,
    })
  },
})
