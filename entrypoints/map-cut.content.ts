/**
 * Инструмент разреза в редакторе Народной карты: растительность и водоёмы.
 *
 * Скрипт работает в MAIN world и стартует на `document_start`: классы
 * активностей редактора объявляются при исполнении бандла НЯК, и хук должен
 * стоять на их прототипах раньше, чем редактор откроет объект.
 */
import { defineContentScript } from 'wxt/utils/define-content-script'
import { CutController, removeCutMessage, setCutState, showCutMessage } from '@/lib/cut'
import { createTranslator, type TranslateFn } from '@/lib/i18n'

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

      console.info('[nmap_cut] content script loaded')

      const controller = new CutController({
        getTranslator: () => t,
        onMessage: (text) => showCutMessage(text),
      })

      const stop = controller.start()

      window.addEventListener('pagehide', () => {
        stop()
        removeCutMessage()
      })
    } catch (error: unknown) {
      // Без этого падение при инициализации выглядит как «скрипт не загрузился»:
      // состояние осталось бы пустым и причина была бы не видна.
      const message = error instanceof Error ? error.message : String(error)
      console.error('[nmap_cut] failed to start', error)
      setCutState(`error:${message.slice(0, 120)}`)
    }
  },
})
