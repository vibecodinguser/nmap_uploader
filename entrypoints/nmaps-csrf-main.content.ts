/**
 * Перехват CSRF-токена редактора Народной карты.
 *
 * Токен нужен запросам истории объектов, а берётся он только из заголовков
 * запросов самого приложения. Скрипт исполняется в MAIN world, потому что
 * из изолированного контекста `fetch` страницы не подменить.
 */
import { defineContentScript } from 'wxt/utils/define-content-script'
import { installCsrfCapture } from '@/lib/object_tracker/csrf_capture'

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    installCsrfCapture()
  },
})
