import { browser } from 'wxt/browser'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'

/**
 * Запрос необязательных разрешений Яндекса из страницы расширения.
 *
 * Разрешения спрашиваются прямо здесь — из панели (`notes-panel.html`) или
 * страницы настроек (`panel.html`), — а не через контент-скрипт редактора.
 *
 * Почему не контент-скриптом: `chrome.permissions` в content scripts
 * недоступен. Из API расширения там видны только `dom`, `i18n`, `storage` и
 * `runtime`, поэтому `browser.permissions.request` из контент-скрипта — это
 * `undefined`, а не отклонённый вызов. Страница расширения в iframe, наоборот,
 * имеет полный доступ к API, а клик внутри iframe даёт ей собственный жест
 * пользователя — ровно то, что нужно `permissions.request`.
 *
 * Побочный плюс: панель, открытая отдельной вкладкой, работает так же, как
 * панель в iframe, — отдельной ветки для этого не нужно.
 */

/**
 * Просит разрешения Яндекса и возвращает, выданы ли они.
 *
 * Вызывать строго из обработчика клика: между жестом пользователя и
 * `permissions.request` не должно быть `await`'ов на сеть или хранилище.
 * Поэтому выдача проверяется до диалога, а не после.
 */
export const requestYandexPermissions = async (): Promise<boolean> => {
  try {
    return await browser.permissions.request(YANDEX_PERMISSION_REQUEST)
  } catch (error: unknown) {
    console.warn('[yamapper] yandex permissions.request failed:', error)
    return false
  }
}
