/**
 * Константы блока создания заметок в сайдбаре Народной карты.
 *
 * Создание живёт отдельно от попапа «Блокнот»: попап управляет заметками,
 * а сайдбар — только добавляет новые.
 */

export const NOTES_TILE_ID = 'nmap-notes-create-tile'
export const NOTES_PANEL_ID = 'nmap-notes-create-panel'
export const NOTES_BACK_ID = 'nmap-notes-create-back'
export const NOTES_STYLES_ID = 'nmap-notes-create-styles'

/**
 * Метка источника выбора координат.
 *
 * Пикер общий: им пользуются и попап, и сайдбар. Метка не даёт попапу
 * показать форму сохранения на чужой выбор.
 */
export const NOTES_PICK_SOURCE = 'notesSidebar' as const

/** Панель выбора категорий: только в ней показываем плитку «Заметки». */
export const GROUPS_VIEW_SELECTOR = '.nk-category-selector-groups-view'

/**
 * Нативный список приподнят отрицательным отступом под заголовок панели.
 * Наш блок лежит в том же контейнере, поэтому отступ приходится сбрасывать.
 */
export const GROUPS_VIEW_MARGIN_TOP = '0px'

/** Контейнер с плитками категорий — наша плитка встаёт последней. */
export const GROUPS_CONTENT_SELECTOR = '.nk-category-selector-groups-view__content'

/** Обёртка скролла: сюда кладём блок создания вместо списка категорий. */
export const SCROLL_CONTENT_SELECTOR = '.nk-scrollable__content-size-observer'

/** Остров редактора: шапка и список категорий живут в одном `.nk-island`. */
export const ISLAND_CLASS = 'nk-island'

/** Шапка панели: сюда встаёт нативная стрелка «Назад». */
export const HEADER_SELECTOR = '.nk-sidebar-header-view'

/** Колонка заголовка: у неё отступ, который занимает место стрелки. */
export const HEADER_TITLE_SELECTOR = '.nk-sidebar-header-view__title'

/** Поиск категорий: в нативном режиме группы он не показывается. */
export const SUGGEST_SELECTOR = '.nk-category-selector-view__suggest'

/**
 * Класс схлопнутого поиска.
 *
 * Блок поиска несёт `border-top` — это и есть разделитель под заголовком.
 * Поэтому его нельзя прятать через `display: none`: снимаем только отступы и
 * содержимое, а рамка остаётся на месте.
 */
export const SUGGEST_COLLAPSED_CLASS = 'nmap-notes-create__suggest-collapsed'

/** Класс отступа заголовка, который освобождает место под стрелку. */
export const TITLE_SHIFT_CLASS_RE = /^nk-grid__col_shift_\d+$/
