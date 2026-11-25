import { PERMISSION_REQUIRED } from '@/lib/notes/storage/errors'
import { requestYandexPermissions } from '@/lib/permissions/panel_requester'
import { hasYandexPermissions } from '@/lib/yandex/permissions'

/**
 * Доступ браузера к Яндексу и его запрос под клик.
 *
 * Тумблеры в настройках включают функции, которые пишут на Диск: «Блокнот»
 * сохраняет туда загрузки, «НСПД» — выгружает найденные объекты. Поэтому при
 * включении любого из них запрашиваются разрешения Яндекса, а при выключении
 * они не отзываются: иначе следующее включение спрашивало бы разрешение и вход
 * заново (ADR 0022).
 *
 * Запрос делает страница расширения (панель настроек), а не контент-скрипт:
 * `chrome.permissions` в content scripts недоступен. Подробности — в
 * `lib/permissions/panel_requester.ts`.
 */

/**
 * Просит разрешения Яндекса под клик пользователя.
 *
 * Вызывать строго из обработчика клика: жест браузера живёт один стек
 * вызовов, и между ним и `permissions.request` не должно быть сетевых
 * запросов. Возвращает `true`, если разрешения выданы (сразу или после
 * диалога).
 */
export const requestYandexAccess = async (): Promise<boolean> => {
  if (await hasYandexPermissions()) return true
  return requestYandexPermissions()
}

/**
 * Почему заметки или загрузка не работают, когда разрешений нет.
 *
 * Одна и та же константа и для фона, и для панели: по ней UI различает
 * «нажмите, чтобы разрешить» и «войдите в Яндекс».
 */
export { PERMISSION_REQUIRED }
