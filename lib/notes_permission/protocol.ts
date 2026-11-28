/**
 * Контракт запроса разрешений Яндекса с кнопки заметок.
 *
 * Кнопка живёт в контент-скрипте тулбара, а `permissions.request` в контент-
 * скрипте недоступен (ADR 0022). Поэтому поверх кнопки, пока разрешений нет,
 * лежит прозрачная страница расширения: клик попадает в неё, даёт ей жест
 * пользователя, и диалог браузера открывается сразу — без промежуточной
 * панели с кнопкой «Разрешить доступ».
 *
 * Общение идёт в две стороны и разными каналами: страница-оверлей говорит с
 * контент-скриптом через `postMessage` своего iframe, а состояние разрешений
 * знает только фон — контент-скрипт спрашивает его сообщением рантайма.
 */

export const NOTES_PERMISSION_OVERLAY_ID = 'yamapper-notes-permission-overlay'

/**
 * iframe → контент-скрипт: страница оверлея загрузилась и готова принимать клик.
 *
 * Нужно, чтобы отличить «оверлей работает» от «страница не загрузилась»:
 * невидимый битый iframe над кнопкой превратился бы в мёртвую зону, где клик
 * не делает ничего.
 */
export const NOTES_PERMISSION_READY_MESSAGE = 'NOTES_PERMISSION_READY'
/** iframe → контент-скрипт: пользователь выдал разрешения. */
export const NOTES_PERMISSION_GRANTED_MESSAGE = 'NOTES_PERMISSION_GRANTED'
/** iframe → контент-скрипт: диалог разрешений отклонили. */
export const NOTES_PERMISSION_DENIED_MESSAGE = 'NOTES_PERMISSION_DENIED'
/**
 * iframe → контент-скрипт: по оверлею кликнули.
 *
 * Нужен, чтобы отличить выдачу разрешений по кнопке заметок (тогда панель
 * открывается) от выдачи в настройках, пока оверлей просто лежит на кнопке.
 */
export const NOTES_PERMISSION_CLICKED_MESSAGE = 'NOTES_PERMISSION_CLICKED'
/** iframe → контент-скрипт: курсор вошёл на кнопку или ушёл с неё. */
export const NOTES_PERMISSION_HOVER_MESSAGE = 'NOTES_PERMISSION_HOVER'

/** Контент-скрипт → фон: выданы ли разрешения Яндекса. */
export const GET_YANDEX_PERMISSIONS_ACTION = 'getYandexPermissions'
/** Фон → вкладки карты: набор разрешений Яндекса изменился. */
export const YANDEX_PERMISSIONS_CHANGED_ACTION = 'yandexPermissionsChanged'
