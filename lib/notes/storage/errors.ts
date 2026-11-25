/**
 * Коды отказа, общие для фона и страниц расширения.
 *
 * `PERMISSION_REQUIRED` — расширению не хватает разрешения браузера на
 * домены Яндекса: оно выдаётся только кликом пользователя. `AUTH_REQUIRED` —
 * разрешения есть, но входа в Яндекс ID нет.
 */
export const PERMISSION_REQUIRED = 'PERMISSION_REQUIRED'
export const AUTH_REQUIRED = 'AUTH_REQUIRED'

export type DiskAccessError = typeof PERMISSION_REQUIRED | typeof AUTH_REQUIRED
