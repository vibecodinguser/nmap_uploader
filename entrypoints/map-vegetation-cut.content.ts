/**
 * Инструмент разреза растительности в редакторе Народной карты.
 *
 * Скрипт работает в MAIN world и стартует на `document_start`: классы
 * активностей редактора объявляются при исполнении бандла НЯК, и хук должен
 * стоять на их прототипах раньше, чем редактор откроет объект.
 */
import { defineContentScript } from 'wxt/utils/define-content-script'
import { createTranslator, type TranslateFn } from '@/lib/i18n'
import {
  removeVegetationCutMessage,
  setVegetationCutState,
  showVegetationCutMessage,
  VegetationCutController,
} from '@/lib/vegetation_cut'

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    try {
      const pageLang = document.documentElement.lang || navigator.language || 'ru'
      const locale = pageLang.toLowerCase().startsWith('en') ? 'en' : 'ru'
      const t: TranslateFn = createTranslator(locale)

      console.info('[nmap_vegetation_cut] content script loaded')

      const controller = new VegetationCutController({
        getTranslator: () => t,
        onMessage: (text) => showVegetationCutMessage(text),
      })

      const stop = controller.start()

      window.addEventListener('pagehide', () => {
        stop()
        removeVegetationCutMessage()
      })
    } catch (error: unknown) {
      // Без этого падение при инициализации выглядит как «скрипт не загрузился»:
      // состояние осталось бы пустым и причина была бы не видна.
      const message = error instanceof Error ? error.message : String(error)
      console.error('[nmap_vegetation_cut] failed to start', error)
      setVegetationCutState(`error:${message.slice(0, 120)}`)
    }
  },
})
