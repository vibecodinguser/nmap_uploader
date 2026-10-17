import { browser } from 'wxt/browser'
import { parseStaticSvg } from '@/lib/parse_static_svg'

export type FeedStatusId = 'all' | 'published' | 'green' | 'yellow' | 'red'

export interface FeedStats {
  total: number
  published: number
  green: number
  yellow: number
  red: number
}

export interface StatusFilterOption {
  readonly id: FeedStatusId
  readonly label: string
  readonly iconClass?: string
  readonly svgMarkup?: string
  readonly colorDot?: string
  readonly colorClass?: string
}

export const FEEDS_FILTER_ENABLED_STORAGE_KEY = 'feeds_filter_enabled'
export const FEEDS_FILTER_SELECT_ID = 'nmap-uploader-feeds-filter-select'
export const FEEDS_FILTER_BAR_ID = FEEDS_FILTER_SELECT_ID
export const FEEDS_FILTER_POPUP_ID = 'nmap-uploader-feeds-filter-popup'
export const FEEDS_FILTER_STYLES_ID = 'nmap-uploader-feeds-filter-styles'
export const FEED_HIDDEN_CLASS = 'nmap-uploader-feed-event-hidden'

export const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { id: 'all', label: 'Все статусы' },
  {
    id: 'published',
    label: 'Правка опубликована',
    iconClass:
      'nk-icon nk-icon_id_commit-published nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#8fcb69"/><path fill="#fff" d="m16.255 6.922-5.659 7.308 1.406 1.089 5.659-7.308zM5.578 10.413l-1.239 1.274L8.054 15.3l5.609-7.291-1.409-1.084-4.392 5.709z"/></g></svg>',
    colorClass: 'nk-badge_color_green',
  },
  {
    id: 'green',
    label: 'Принятые',
    iconClass:
      'nk-icon nk-icon_id_commit-approved nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#8fcb69"/><path fill="#fff" d="m7.92 10.446-1.24 1.275 3.716 3.612 5.609-7.291-1.41-1.084-4.391 5.709z"/></g></svg>',
    colorClass: 'nk-badge_color_green',
  },
  {
    id: 'yellow',
    label: 'На проверке',
    iconClass:
      'nk-icon nk-icon_id_commit-pending nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#fc5"/><path fill="#fff" d="M12 5h-2v6.535l4.277 2.852 1.11-1.664L12 10.465z"/></g></svg>',
    colorClass: 'nk-badge_color_yellow',
  },
  {
    id: 'red',
    label: 'Отклоненные',
    iconClass:
      'nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#ff6464"/><path fill="#fff" d="m8.172 6.757 7.07 7.071-1.414 1.415-7.07-7.071z"/><path fill="#fff" d="m15.243 8.172-7.071 7.07-1.415-1.414 7.071-7.07z"/></g></svg>',
    colorClass: 'nk-badge_color_red',
  },
]

/**
 * Возвращает сохраненное состояние активности фильтра истории правок (по умолчанию выключен).
 */
export const getStoredFeedsFilterEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(FEEDS_FILTER_ENABLED_STORAGE_KEY)
  const value = stored[FEEDS_FILTER_ENABLED_STORAGE_KEY]
  return value === undefined ? false : Boolean(value)
}

/**
 * Сохраняет состояние активности фильтра истории правок в хранилище браузера.
 */
export const setStoredFeedsFilterEnabled = async (enabled: boolean): Promise<void> => {
  await browser.storage.local.set({ [FEEDS_FILTER_ENABLED_STORAGE_KEY]: enabled })
}

/**
 * Извлекает статус правки из элемента состояния коммита (nk-commit-state-view / nk-event-view__commit-state / nk-icon_id_commit-*).
 */
export const getCommitStateStatus = (card: HTMLElement): FeedStatusId | null => {
  const stateElement =
    (card.matches(
      '.nk-event-view__commit-state, .nk-commit-state-view, [class*="commit-state-view"], [class*="icon_id_commit-"]',
    )
      ? card
      : null) ||
    card.querySelector<HTMLElement>('.nk-event-view__commit-state') ||
    card.querySelector<HTMLElement>('.nk-commit-state-view') ||
    card.querySelector<HTMLElement>('[class*="commit-state-view"]') ||
    card.querySelector<HTMLElement>('[class*="icon_id_commit-"]')

  if (!stateElement) {
    return null
  }

  const iconChild = stateElement.querySelector<HTMLElement>('[class*="icon_id_commit-"]')
  const combinedClasses =
    `${stateElement.className} ${iconChild ? iconChild.className : ''}`.toLowerCase()

  // 1. Проверка по модификаторам и ID иконки коммита
  if (
    combinedClasses.includes('commit-rejected') ||
    combinedClasses.includes('commit-declined') ||
    combinedClasses.includes('commit-canceled') ||
    combinedClasses.includes('commit-cancelled') ||
    combinedClasses.includes('state_rejected') ||
    combinedClasses.includes('state-rejected')
  ) {
    return 'red'
  }

  if (
    combinedClasses.includes('commit-published') ||
    combinedClasses.includes('state_published') ||
    combinedClasses.includes('state-published')
  ) {
    return 'published'
  }

  if (
    combinedClasses.includes('commit-accepted') ||
    combinedClasses.includes('commit-approved') ||
    combinedClasses.includes('commit-applied') ||
    combinedClasses.includes('commit-success') ||
    combinedClasses.includes('commit-committed') ||
    combinedClasses.includes('state_accepted') ||
    combinedClasses.includes('state_approved')
  ) {
    return 'green'
  }

  if (
    combinedClasses.includes('commit-pending') ||
    combinedClasses.includes('commit-moderation') ||
    combinedClasses.includes('commit-review') ||
    combinedClasses.includes('commit-waiting') ||
    combinedClasses.includes('commit-in-progress') ||
    combinedClasses.includes('state_pending') ||
    combinedClasses.includes('state_moderation')
  ) {
    return 'yellow'
  }

  // 2. Проверка по цветовым классам BEM
  if (combinedClasses.includes('color_green') || combinedClasses.includes('badge_color_green')) {
    return 'green'
  }
  if (
    combinedClasses.includes('color_yellow') ||
    combinedClasses.includes('color_orange') ||
    combinedClasses.includes('badge_color_yellow') ||
    combinedClasses.includes('badge_color_orange')
  ) {
    return 'yellow'
  }
  if (combinedClasses.includes('color_red') || combinedClasses.includes('badge_color_red')) {
    return 'red'
  }

  // 3. Проверка по атрибутам title, aria-label или текстовому содержимому
  const titleText = (
    stateElement.getAttribute('title') ||
    stateElement.getAttribute('aria-label') ||
    iconChild?.getAttribute('title') ||
    iconChild?.getAttribute('aria-label') ||
    stateElement.textContent ||
    ''
  )
    .trim()
    .toLowerCase()

  if (titleText) {
    if (/(опубликован|published)/i.test(titleText)) {
      return 'published'
    }
    if (/(принят|одобрен|согласован|approved|accepted|committed)/i.test(titleText)) {
      return 'green'
    }
    if (/(проверк|модерац|ожида|рассмотр|pending|review|waiting)/i.test(titleText)) {
      return 'yellow'
    }
    if (/(отклон|отказ|исправлен|rejected|declined|canceled)/i.test(titleText)) {
      return 'red'
    }
  }

  return null
}

/**
 * Определяет статус правки по состоянию коммита или бейджу nk-event-view__badge.
 */
export const getEventCardStatus = (card: HTMLElement): FeedStatusId | 'other' => {
  // 1. Приоритетный поиск по состоянию коммита
  const commitStatus = getCommitStateStatus(card)
  if (commitStatus) {
    return commitStatus
  }

  // 2. Резервный поиск по бейджу
  const badge =
    (card.matches('.nk-event-view__badge, .nk-badge') ? card : null) ||
    card.querySelector<HTMLElement>('.nk-event-view__badge') ||
    card.querySelector<HTMLElement>('.nk-badge')

  if (!badge) {
    return 'other'
  }

  const className = badge.className || ''
  const text = (badge.textContent || '').trim().toLowerCase()

  // Проверка по цвету бейджа БЭМ
  if (className.includes('nk-badge_color_green') || className.includes('color_green')) {
    return 'green'
  }
  if (
    className.includes('nk-badge_color_yellow') ||
    className.includes('nk-badge_color_orange') ||
    className.includes('color_yellow') ||
    className.includes('color_orange')
  ) {
    return 'yellow'
  }
  if (className.includes('nk-badge_color_red') || className.includes('color_red')) {
    return 'red'
  }

  // Резервная проверка по тексту статуса
  if (/(опубликован|published)/i.test(text)) {
    return 'published'
  }
  if (/(принят|одобрен|согласован|approved|accepted)/i.test(text)) {
    return 'green'
  }
  if (/(проверк|модерац|ожида|pending|review)/i.test(text)) {
    return 'yellow'
  }
  if (/(отклон|отказ|исправлен|rejected|declined)/i.test(text)) {
    return 'red'
  }

  return 'other'
}

/**
 * Находит карточки событий в контейнере, исключая внутренние элементы BEM (с двойным подчеркиванием).
 */
export const getEventCards = (container: HTMLElement): HTMLElement[] => {
  const directCards = Array.from(container.querySelectorAll<HTMLElement>('.nk-event-view'))
  if (directCards.length > 0) {
    return directCards
  }

  return Array.from(container.querySelectorAll<HTMLElement>('[class*="event-view"]')).filter(
    (el) => !/[a-z0-9_-]+__/.test(el.className),
  )
}

/**
 * Подключает изолированные CSS-стили для дропдауна фильтра и скрытия карточек.
 */
export const ensureFeedFilterStyles = (): void => {
  if (document.getElementById(FEEDS_FILTER_STYLES_ID)) {
    return
  }

  const styleEl = document.createElement('style')
  styleEl.id = FEEDS_FILTER_STYLES_ID
  styleEl.textContent = `
    .${FEED_HIDDEN_CLASS} {
      display: none !important;
    }
    .nmap-feeds-status-select {
      display: inline-block !important;
      vertical-align: middle !important;
      margin-left: 8px !important;
      position: relative !important;
      font-family: var(--nk-user-bar-font-family, "YS Text", -apple-system, BlinkMacSystemFont, Arial, sans-serif);
      pointer-events: auto !important;
      box-sizing: border-box !important;
      height: var(--nmap-feeds-select-height, 32px) !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 10 !important;
    }
    .nmap-feeds-status-select .nk-select__button {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 6px !important;
      height: var(--nmap-feeds-select-height, 32px) !important;
      min-height: var(--nmap-feeds-select-height, 32px) !important;
      max-height: var(--nmap-feeds-select-height, 32px) !important;
      line-height: normal !important;
      padding: 0 28px 0 10px !important;
      border-radius: 4px !important;
      border: 1px solid rgba(0, 0, 0, 0.2) !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-size: 13px !important;
      font-family: inherit !important;
      cursor: pointer !important;
      box-sizing: border-box !important;
      white-space: nowrap !important;
      user-select: none !important;
      pointer-events: auto !important;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .nmap-feeds-status-select .nk-select__button:hover {
      border-color: rgba(0, 0, 0, 0.4) !important;
      background: #f8f8f8 !important;
    }
    .nmap-feeds-status-select.nk-select_opened .nk-select__button {
      border-color: #ffdb4d !important;
      box-shadow: 0 0 0 1px #ffdb4d !important;
    }
    .nmap-feeds-status-select .nk-select__text {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      pointer-events: none !important;
    }
    .nmap-feeds-status-select .nk-select__tick {
      position: absolute !important;
      top: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 28px !important;
      pointer-events: none !important;
      transition: transform 0.2s ease !important;
    }
    .nmap-feeds-status-select.nk-select_opened .nk-select__tick {
      transform: rotate(180deg) !important;
    }
    .nmap-feeds-status-popup {
      position: fixed !important;
      z-index: 2147483647 !important;
      min-width: 175px !important;
      background: #ffffff !important;
      color: #000000 !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25) !important;
      border: 1px solid rgba(0, 0, 0, 0.15) !important;
      padding: 4px 0 !important;
      font-family: var(--nk-user-bar-font-family, "YS Text", -apple-system, BlinkMacSystemFont, Arial, sans-serif) !important;
      font-size: 13px !important;
      box-sizing: border-box !important;
      pointer-events: auto !important;
    }
    .nmap-feeds-status-popup.nk-popup_visible {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    .nmap-feeds-status-popup .nk-menu__item {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 6px 12px !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: background-color 0.1s ease !important;
    }
    .nmap-feeds-status-popup .nk-menu__item:hover {
      background-color: rgba(0, 0, 0, 0.05) !important;
    }
    .nmap-feeds-status-popup .nk-menu__item_checked {
      background-color: rgba(0, 0, 0, 0.08) !important;
      font-weight: 600 !important;
    }
    .nmap-feeds-status-select .nk-commit-state-view,
    .nmap-feeds-status-popup .nk-commit-state-view {
      position: static !important;
      left: auto !important;
      top: auto !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 16px !important;
      height: 16px !important;
      min-width: 16px !important;
      min-height: 16px !important;
      margin: 0 !important;
      padding: 0 !important;
      flex-shrink: 0 !important;
      vertical-align: middle !important;
    }
    .nmap-feeds-status-select .nk-commit-state-view svg,
    .nmap-feeds-status-popup .nk-commit-state-view svg {
      display: block !important;
      width: 16px !important;
      height: 16px !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
    }
    .nmap-status-count-badge {
      margin-left: auto !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      padding: 1px 6px !important;
      border-radius: 10px !important;
      background: rgba(0, 0, 0, 0.08) !important;
      color: inherit !important;
    }
    @media (prefers-color-scheme: dark) {
      .nmap-feeds-status-select .nk-select__button {
        background: #2b2b2b !important;
        color: #ffffff !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      .nmap-feeds-status-select .nk-select__button:hover {
        background: #333333 !important;
        border-color: rgba(255, 255, 255, 0.35) !important;
      }
      .nmap-feeds-status-popup {
        background: #2b2b2b !important;
        color: #ffffff !important;
        border-color: rgba(255, 255, 255, 0.18) !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      }
      .nmap-feeds-status-popup .nk-menu__item:hover {
        background-color: rgba(255, 255, 255, 0.08) !important;
      }
      .nmap-feeds-status-popup .nk-menu__item_checked {
        background-color: rgba(255, 255, 255, 0.15) !important;
      }
      .nmap-status-count-badge {
        background: rgba(255, 255, 255, 0.15) !important;
      }
    }
  `
  document.head.appendChild(styleEl)
}

/**
 * Применяет активный фильтр к карточкам событий и подсчитывает статистику.
 */
export const applyFeedFilter = (container: HTMLElement, filter: FeedStatusId): FeedStats => {
  const cards = getEventCards(container)

  const stats: FeedStats = {
    total: cards.length,
    published: 0,
    green: 0,
    yellow: 0,
    red: 0,
  }

  if (cards.length === 0) {
    return stats
  }

  for (const card of cards) {
    const status = getEventCardStatus(card)

    if (status === 'published') {
      stats.published += 1
    } else if (status === 'green') {
      stats.green += 1
    } else if (status === 'yellow') {
      stats.yellow += 1
    } else if (status === 'red') {
      stats.red += 1
    }

    const matchesFilter = filter === 'all' || status === filter

    if (matchesFilter) {
      card.classList.remove(FEED_HIDDEN_CLASS)
    } else {
      card.classList.add(FEED_HIDDEN_CLASS)
    }
  }

  return stats
}

/**
 * Контроллер дропдауна фильтрации статусов правок.
 */
export interface FilterDropdownController {
  element: HTMLElement
  popupElement: HTMLElement
  updateCounters: (stats: FeedStats) => void
  setActiveFilter: (status: FeedStatusId) => void
  syncHeight: (referenceSelect?: HTMLElement | null) => number
  teardown: () => void
}

/**
 * Создает элемент дропдауна в стиле `nk-select nk-select_theme_islands nk-select_size_m`.
 */
export const createFilterDropdownElement = (
  onFilterChange: (status: FeedStatusId) => void,
  initialFilter: FeedStatusId = 'all',
): FilterDropdownController => {
  const selectHost = document.createElement('span')
  selectHost.id = FEEDS_FILTER_SELECT_ID
  selectHost.className =
    'nk-select nk-select_theme_islands nk-select_size_m nmap-feeds-status-select'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
  button.setAttribute('aria-haspopup', 'listbox')
  button.setAttribute('aria-expanded', 'false')
  button.setAttribute('aria-label', 'Фильтр по статусу правок')

  const textSpan = document.createElement('span')
  textSpan.className = 'nk-button__text nk-select__text'

  const buttonIcon = document.createElement('span')
  buttonIcon.className = 'nk-icon'
  buttonIcon.style.display = 'none'
  buttonIcon.setAttribute('aria-hidden', 'true')
  textSpan.appendChild(buttonIcon)

  const buttonLabel = document.createElement('span')
  buttonLabel.textContent = 'Все статусы'
  textSpan.appendChild(buttonLabel)

  const buttonCount = document.createElement('span')
  buttonCount.className = 'nmap-status-count-badge'
  buttonCount.textContent = '0'
  textSpan.appendChild(buttonCount)

  button.appendChild(textSpan)

  const tickSpan = document.createElement('span')
  tickSpan.className = 'nk-select__tick'
  tickSpan.setAttribute('aria-hidden', 'true')
  button.appendChild(tickSpan)

  selectHost.appendChild(button)

  // Попап меню
  const popup = document.createElement('div')
  popup.id = FEEDS_FILTER_POPUP_ID
  popup.className = 'nk-popup nk-popup_theme_islands nmap-feeds-status-popup'
  popup.style.display = 'none'

  const menu = document.createElement('div')
  menu.className = 'nk-menu nk-menu_theme_islands nk-menu_size_m nk-menu_mode_radio'
  menu.setAttribute('role', 'listbox')
  popup.appendChild(menu)

  const itemMap = new Map<FeedStatusId, { itemElement: HTMLElement; countBadge: HTMLSpanElement }>()

  let currentSelectedStatus = initialFilter
  let latestStats: FeedStats = { total: 0, published: 0, green: 0, yellow: 0, red: 0 }

  STATUS_FILTER_OPTIONS.forEach((opt) => {
    const item = document.createElement('div')
    item.className = `nk-menu__item nk-menu__item_theme_islands ${opt.id === initialFilter ? 'nk-menu__item_checked' : ''}`
    item.dataset.status = opt.id
    item.setAttribute('role', 'option')
    item.setAttribute('aria-selected', opt.id === initialFilter ? 'true' : 'false')

    if (opt.iconClass && opt.svgMarkup) {
      const icon = document.createElement('span')
      icon.className = opt.iconClass
      icon.setAttribute('aria-hidden', 'true')
      icon.appendChild(parseStaticSvg(opt.svgMarkup))
      item.appendChild(icon)
    }

    const label = document.createElement('span')
    label.textContent = opt.label
    item.appendChild(label)

    const badge = document.createElement('span')
    badge.className = 'nmap-status-count-badge'
    badge.textContent = '0'
    item.appendChild(badge)

    item.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        event.stopPropagation()
        setActiveFilter(opt.id)
        closePopup()
        onFilterChange(opt.id)
      },
      true,
    )

    itemMap.set(opt.id, { itemElement: item, countBadge: badge })
    menu.appendChild(item)
  })

  let isPopupOpen = false

  const openPopup = (): void => {
    if (!popup.parentElement) {
      document.body.appendChild(popup)
    }

    const rect = button.getBoundingClientRect()
    popup.style.position = 'fixed'
    popup.style.top = `${Math.round(rect.bottom + 4)}px`
    popup.style.left = `${Math.round(rect.left)}px`
    popup.style.display = 'block'
    popup.style.visibility = 'visible'
    popup.style.opacity = '1'

    selectHost.classList.add('nk-select_opened')
    popup.classList.add('nk-popup_visible')
    button.setAttribute('aria-expanded', 'true')
    isPopupOpen = true

    // Отложенная привязка слушателей закрытия, чтобы текущий клик не вызвал мгновенное закрытие
    window.setTimeout(() => {
      if (isPopupOpen) {
        document.addEventListener('pointerdown', handleDocumentPointerDown, true)
        window.addEventListener('keydown', handleWindowKeyDown, true)
      }
    }, 50)
  }

  const closePopup = (): void => {
    if (!isPopupOpen) {
      return
    }

    popup.style.display = 'none'
    popup.style.visibility = 'hidden'
    popup.classList.remove('nk-popup_visible')
    selectHost.classList.remove('nk-select_opened')
    button.setAttribute('aria-expanded', 'false')
    isPopupOpen = false

    document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    window.removeEventListener('keydown', handleWindowKeyDown, true)
  }

  const handleDocumentPointerDown = (event: MouseEvent | PointerEvent): void => {
    const target = event.target as Node | null
    if (!target) {
      return
    }

    // Если клик по самому селекту или элементам меню - не закрываем здесь
    if (selectHost.contains(target) || popup.contains(target)) {
      return
    }

    closePopup()
  }

  const handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      closePopup()
    }
  }

  const handleToggleDropdown = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()

    if (isPopupOpen) {
      closePopup()
    } else {
      openPopup()
    }
  }

  // Перехватываем клик и нажатия в фазе capture, чтобы родительские обработчики Яндекс Карт не блокировали событие
  button.addEventListener('click', handleToggleDropdown, true)
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  button.addEventListener('mousedown', (event) => {
    event.stopPropagation()
  })
  button.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      handleToggleDropdown(event)
    }
  })

  const syncButtonDisplay = (status: FeedStatusId): void => {
    const option = STATUS_FILTER_OPTIONS.find((opt) => opt.id === status)
    if (!option) {
      return
    }

    buttonLabel.textContent = option.label

    if (option.iconClass && option.svgMarkup) {
      buttonIcon.className = option.iconClass
      buttonIcon.replaceChildren(parseStaticSvg(option.svgMarkup))
      buttonIcon.style.display = 'inline-flex'
    } else {
      buttonIcon.className = 'nk-icon'
      buttonIcon.replaceChildren()
      buttonIcon.style.display = 'none'
    }

    let countValue = latestStats.total
    if (status === 'published') countValue = latestStats.published
    else if (status === 'green') countValue = latestStats.green
    else if (status === 'yellow') countValue = latestStats.yellow
    else if (status === 'red') countValue = latestStats.red

    buttonCount.textContent = String(countValue)
  }

  const setActiveFilter = (status: FeedStatusId): void => {
    currentSelectedStatus = status

    itemMap.forEach(({ itemElement }, id) => {
      const isChecked = id === status
      itemElement.classList.toggle('nk-menu__item_checked', isChecked)
      itemElement.setAttribute('aria-selected', isChecked ? 'true' : 'false')
    })

    syncButtonDisplay(status)
  }

  const updateCounters = (stats: FeedStats): void => {
    latestStats = stats

    const allItem = itemMap.get('all')
    if (allItem) allItem.countBadge.textContent = String(stats.total)

    const publishedItem = itemMap.get('published')
    if (publishedItem) publishedItem.countBadge.textContent = String(stats.published)

    const greenItem = itemMap.get('green')
    if (greenItem) greenItem.countBadge.textContent = String(stats.green)

    const yellowItem = itemMap.get('yellow')
    if (yellowItem) yellowItem.countBadge.textContent = String(stats.yellow)

    const redItem = itemMap.get('red')
    if (redItem) redItem.countBadge.textContent = String(stats.red)

    syncButtonDisplay(currentSelectedStatus)
  }

  const syncHeight = (referenceSelect?: HTMLElement | null): number => {
    return syncFilterDropdownHeight(selectHost, referenceSelect)
  }

  // Применяем начальную высоту сразу при создании
  syncFilterDropdownHeight(selectHost)
  syncButtonDisplay(initialFilter)

  const teardown = (): void => {
    closePopup()
    popup.remove()
    selectHost.remove()
  }

  return {
    element: selectHost,
    popupElement: popup,
    updateCounters,
    setActiveFilter,
    syncHeight,
    teardown,
  }
}

/**
 * Ищет элемент шапки или панели управления ленты событий строго внутри контейнера ленты.
 */
export const findFeedHeader = (container?: HTMLElement | null): HTMLElement | null => {
  const headerSelectors = [
    '.nk-user-feeds-view__header',
    '.nk-user-feed-view__header',
    '.nk-feeds-view__header',
    '.nk-feed-view__header',
    '.nk-feed-header-view',
    '[class*="user-feeds-view__header"]',
    '[class*="user-feed-view__header"]',
    '[class*="feeds-view__header"]',
    '[class*="feed-header"]',
    '.nk-user-feeds-view__controls',
    '[class*="user-feeds-view__controls"]',
    '.nk-sidebar-view__header',
    '[class*="sidebar-view__header"]',
    '.nk-header-view',
  ]

  if (container) {
    for (const selector of headerSelectors) {
      const inContainer = container.querySelector<HTMLElement>(selector)
      if (inContainer) {
        return inContainer
      }
    }
    for (const selector of headerSelectors) {
      if (container.matches(selector)) {
        return container
      }
    }
  }

  for (const selector of headerSelectors) {
    const found = document.querySelector<HTMLElement>(selector)
    if (found) {
      const sidebar = found.closest('.nk-sidebar-view')
      if (sidebar) {
        const hasFeed =
          sidebar.querySelector('.nk-event-view, [class*="event-view"], [class*="feed"]') !== null
        if (hasFeed) {
          return found
        }
      } else {
        return found
      }
    }
  }

  return null
}

/**
 * Проверяет, является ли кандидат допустимым целевым селектом Народной карты,
 * рядом с которым можно разместить дропдаун фильтра статусов.
 */
export const isValidTargetSelect = (
  candidate: Element | null,
  dropdownElement?: HTMLElement | null,
): candidate is HTMLElement => {
  if (!candidate || !(candidate instanceof HTMLElement)) {
    return false
  }

  // Не может быть собственным элементом фильтра или его попапом
  if (candidate.id === FEEDS_FILTER_SELECT_ID || candidate.id === FEEDS_FILTER_POPUP_ID) {
    return false
  }

  // Не может быть частью/потомком нашего фильтра статусов
  if (
    candidate.closest(
      `#${FEEDS_FILTER_SELECT_ID}, #${FEEDS_FILTER_POPUP_ID}, .nmap-feeds-status-select, .nmap-feeds-status-popup`,
    )
  ) {
    return false
  }

  // Не может быть тем же элементом, предком или потомком переданного dropdownElement
  if (
    dropdownElement &&
    (dropdownElement === candidate ||
      dropdownElement.contains(candidate) ||
      candidate.contains(dropdownElement))
  ) {
    return false
  }

  // Не должен находиться внутри тулбара редактора, панели пользователя или кнопок управления
  // Разрешаем селекты внутри сайдбара ленты событий (.nk-sidebar-view)
  if (
    candidate.closest(
      '.nk-user-feeds-control-view, .nk-toolbar-view, [class*="toolbar-view"], [class*="user-bar-view"], button:not(.nk-select), [class*="control-view"]:not([class*="feed"])',
    )
  ) {
    return false
  }

  // Целевой селект в БЭМ-разметке Яндекса — это блок .nk-select или селект.
  // Исключаем элементы БЭМ, такие как .nk-select__button, .nk-select__text, .nk-select__tick
  if (
    candidate.classList.contains('nk-select__button') ||
    candidate.classList.contains('nk-select__text') ||
    candidate.classList.contains('nk-select__tick') ||
    candidate.classList.contains('nk-select__menu')
  ) {
    return false
  }

  const classList = Array.from(candidate.classList)
  const isSelect =
    classList.some(
      (cls) => cls === 'nk-select' || cls.startsWith('nk-select_') || cls.includes('select'),
    ) && !classList.some((cls) => cls.startsWith('nk-select__'))

  return isSelect
}

/**
 * Проверяет, выбран ли в целевом селекте режим "Правки".
 * В интерфейсе Народной карты текст текущего выбранного значения содержится в
 * <span class="nk-button__text">Правки</span> (или .nk-select__text / button).
 */
export const isEditsModeSelected = (targetSelect?: HTMLElement | null): boolean => {
  if (!targetSelect || !(targetSelect instanceof HTMLElement)) {
    return false
  }

  // Исключаем собственный дропдаун фильтра статусов
  if (
    targetSelect.id === FEEDS_FILTER_SELECT_ID ||
    targetSelect.classList.contains('nmap-feeds-status-select') ||
    targetSelect.closest(`#${FEEDS_FILTER_SELECT_ID}`)
  ) {
    return false
  }

  const textElement =
    targetSelect.querySelector<HTMLElement>('.nk-button__text, .nk-select__text') ||
    targetSelect.querySelector<HTMLElement>('button') ||
    targetSelect

  const rawText = (textElement.textContent || '').trim().toLowerCase()
  if (!rawText) {
    return false
  }

  // Режим "Правки" (на русском или английском)
  return rawText.includes('правк') || rawText.includes('edit')
}

/**
 * Ищет целевой селект nk-select в интерфейсе Народной карты строго внутри контейнера ленты.
 * Исключает сам фильтр расширения и все его дочерние узлы (кнопки, текст, иконки).
 * Приоритетно выбирает селект, в котором выбран режим "Правки".
 */
export const findTargetSelect = (
  container?: HTMLElement | null,
  dropdownElement?: HTMLElement | null,
): HTMLElement | null => {
  const notMeSelector = `:not(#${FEEDS_FILTER_SELECT_ID}):not(.nmap-feeds-status-select)`

  const queryCandidateSelects = (root: ParentNode): HTMLElement[] => {
    const rawList = root.querySelectorAll<HTMLElement>(
      `.nk-select${notMeSelector}, [class*="nk-select"]${notMeSelector}`,
    )
    const valid: HTMLElement[] = []
    for (let i = 0; i < rawList.length; i++) {
      const candidate = rawList[i]
      if (isValidTargetSelect(candidate, dropdownElement)) {
        valid.push(candidate)
      }
    }
    return valid
  }

  const pickBestSelect = (candidates: HTMLElement[]): HTMLElement | null => {
    if (candidates.length === 0) {
      return null
    }
    const editsSelect = candidates.find((c) => isEditsModeSelected(c))
    if (editsSelect) {
      return editsSelect
    }
    return candidates[0]
  }

  // 1. Приоритетный поиск в шапке ленты (где обычно располагаются штатные селекты фильтров)
  const header = findFeedHeader(container)
  if (header) {
    const candidates = queryCandidateSelects(header)
    const best = pickBestSelect(candidates)
    if (best) {
      return best
    }
  }

  // 2. Поиск внутри переданного контейнера ленты
  if (container) {
    const candidates = queryCandidateSelects(container)
    const best = pickBestSelect(candidates)
    if (best) {
      return best
    }
  }

  // 3. Поиск внутри сайдбара ленты событий в документе
  const scopedRoots = document.querySelectorAll<HTMLElement>(
    '.nk-user-feeds-view, .nk-user-feed-view, .nk-feeds-view, .nk-feed-view, .nk-events-view, [class*="user-feeds-view"], [class*="user-feed-view"], .nk-sidebar-view',
  )
  for (let i = 0; i < scopedRoots.length; i++) {
    const root = scopedRoots[i]
    if (root.classList.contains('nk-sidebar-view')) {
      const hasFeed =
        root.querySelector('.nk-event-view, [class*="event-view"], [class*="feed"]') !== null
      if (!hasFeed) {
        continue
      }
    }
    const candidates = queryCandidateSelects(root)
    const best = pickBestSelect(candidates)
    if (best) {
      return best
    }
  }

  return null
}

/**
 * Измеряет высоту целевого nk-select и синхронизирует высоту кнопки дропдауна фильтра.
 * Копирует точную высоту соседнего селекта (в px), предотвращая расхождение размеров.
 */
export const syncFilterDropdownHeight = (
  dropdownElement: HTMLElement,
  referenceSelect?: HTMLElement | null,
): number => {
  const target = referenceSelect || findTargetSelect(null, dropdownElement)
  let measuredHeight = 0

  if (target) {
    const targetButton =
      target.querySelector<HTMLElement>(
        'button.nk-select__button, button.nk-button, .nk-select__button',
      ) || target
    const rect = targetButton.getBoundingClientRect()
    if (rect.height > 0) {
      measuredHeight = Math.round(rect.height)
    } else {
      const computed = window.getComputedStyle(targetButton)
      const parsed = Number.parseFloat(computed.height)
      if (!Number.isNaN(parsed) && parsed > 0) {
        measuredHeight = Math.round(parsed)
      } else if (targetButton.offsetHeight > 0) {
        measuredHeight = targetButton.offsetHeight
      }
    }
  }

  // Стандартная высота для nk-select_size_m в интерфейсе Islands — 32px
  const effectiveHeight = measuredHeight > 0 ? measuredHeight : 32
  const heightPx = `${effectiveHeight}px`

  dropdownElement.style.setProperty('--nmap-feeds-select-height', heightPx)
  dropdownElement.style.height = heightPx
  dropdownElement.style.minHeight = heightPx

  const button = dropdownElement.querySelector<HTMLElement>('.nk-select__button')
  if (button) {
    button.style.height = heightPx
    button.style.minHeight = heightPx
    button.style.maxHeight = heightPx
  }

  return effectiveHeight
}

/**
 * Ищет целевой селект nk-select в интерфейсе Народной карты (выбор категории событий ленты)
 * и размещает дропдаун фильтра статусов ТОЛЬКО тогда, когда в целевом селекте выбран режим "Правки".
 * Если целевой селект не найден или в нем выбран другой режим (например, "Комментарии"),
 * дропдаун скрывается и не отображается, а функция возвращает false.
 */
export const attachFilterDropdownToDom = (
  dropdownElement: HTMLElement,
  container: HTMLElement,
): boolean => {
  if (!container || !dropdownElement) {
    return false
  }

  // Защита от ошибочного монтирования в кнопки или контролы тулбара редактора
  if (
    container.matches(
      '.nk-user-feeds-control-view, .nk-toolbar-view, [class*="toolbar"], button, [class*="btn"]',
    )
  ) {
    return false
  }

  const targetSelect = findTargetSelect(container, dropdownElement)

  // Наш дропдаун должен отображаться ТОЛЬКО тогда, когда в штатном селекте выбран пункт "Правки"
  if (!targetSelect || !isEditsModeSelected(targetSelect)) {
    if (dropdownElement.parentElement) {
      dropdownElement.style.display = 'none'
    }
    return false
  }

  // Гарантированная защита от HierarchyRequestError:
  // targetSelect не может совпадать с dropdownElement, содержать его или быть внутри него
  if (
    targetSelect === dropdownElement ||
    dropdownElement.contains(targetSelect) ||
    targetSelect.contains(dropdownElement)
  ) {
    return false
  }

  dropdownElement.style.display = ''

  if (targetSelect.nextElementSibling !== dropdownElement) {
    try {
      targetSelect.insertAdjacentElement('afterend', dropdownElement)
    } catch (error) {
      console.warn(
        '[nmap-uploader] Ошибка при размещении селекта фильтра рядом с targetSelect:',
        error,
      )
      return false
    }
  }
  syncFilterDropdownHeight(dropdownElement, targetSelect)
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      syncFilterDropdownHeight(dropdownElement, targetSelect)
    })
  }
  return true
}

/**
 * Находит корневой контейнер ленты правок/событий в DOM.
 * Возвращает контейнер шторки ленты (.nk-user-feeds-view / .nk-sidebar-view) и игнорирует кнопки тулбара редактора.
 */
export const findFeedContainer = (root: ParentNode = document): HTMLElement | null => {
  // 1. Поиск по наличию карточек событий и их общего предка
  const eventCards =
    root instanceof HTMLElement
      ? getEventCards(root)
      : Array.from(root.querySelectorAll<HTMLElement>('.nk-event-view'))
  const eventCard = eventCards[0]
  if (eventCard) {
    const parentContainer =
      eventCard.closest<HTMLElement>(
        '.nk-user-feeds-view, .nk-user-feed-view, .nk-feeds-view, .nk-feed-view, .nk-events-view, [class*="user-feed"], [class*="feeds-view"], [class*="events-view"]',
      ) ||
      eventCard.closest<HTMLElement>('.nk-sidebar-view') ||
      eventCard.parentElement

    if (
      parentContainer &&
      !parentContainer.matches(
        '.nk-user-feeds-control-view, .nk-toolbar-view, [class*="toolbar"], button',
      )
    ) {
      return parentContainer
    }
  }

  // 2. Поиск по классам представления ленты пользователя
  const knownView =
    root.querySelector<HTMLElement>('.nk-user-feeds-view') ||
    root.querySelector<HTMLElement>('.nk-user-feed-view') ||
    root.querySelector<HTMLElement>('.nk-feeds-view') ||
    root.querySelector<HTMLElement>('.nk-feed-view') ||
    root.querySelector<HTMLElement>('.nk-events-view') ||
    root.querySelector<HTMLElement>(
      '[class*="user-feeds-view"]:not([class*="control-view"]):not(button)',
    ) ||
    root.querySelector<HTMLElement>(
      '[class*="user-feed-view"]:not([class*="control-view"]):not(button)',
    ) ||
    root.querySelector<HTMLElement>(
      '[class*="feeds-view"]:not([class*="control-view"]):not(button)',
    )

  if (knownView) {
    return knownView
  }

  // 3. Поиск по открытому сайдбару с признаками ленты событий
  const sidebar = root.querySelector<HTMLElement>('.nk-sidebar-view')
  if (sidebar) {
    const hasFeed =
      sidebar.querySelector('.nk-event-view, [class*="event-view"], [class*="feed"]') !== null
    if (hasFeed) {
      return sidebar
    }
  }

  // 4. Проверяем, не является ли сам root элементом ленты
  if (
    root instanceof HTMLElement &&
    root.matches(
      '.nk-user-feeds-view, .nk-user-feed-view, .nk-feeds-view, .nk-feed-view, .nk-events-view, [class*="user-feed"], [class*="feeds-view"]',
    ) &&
    !root.matches('.nk-user-feeds-control-view, .nk-toolbar-view, [class*="control-view"], button')
  ) {
    return root
  }

  return null
}

const RUSSIAN_MONTHS_MAP: Record<string, number> = {
  янв: 0,
  фев: 1,
  мар: 2,
  апр: 3,
  май: 4,
  мая: 4,
  июн: 5,
  июл: 6,
  авг: 7,
  сен: 8,
  окт: 9,
  ноя: 10,
  дек: 11,
}

/**
 * Разбирает текстовую строку даты/времени Народной карты в объект Date.
 */
export const parseEventDateString = (
  rawText: string,
  referenceTimestamp = Date.now(),
): Date | null => {
  const text = rawText.trim().toLowerCase()
  if (!text) {
    return null
  }

  // 1. Стандартный ISO или дата в формате YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const parsed = Date.parse(text)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }
  }

  // 2. Относительное время: "только что"
  if (text.includes('только что')) {
    return new Date(referenceTimestamp)
  }

  // 3. Относительное время: N секунд / минут / часов / дней назад
  const relativeMatch = text.match(/(\d+)\s*(сек|мин|час|ч\b|дн|ден)/)
  if (relativeMatch && text.includes('назад')) {
    const value = Number.parseInt(relativeMatch[1], 10)
    const unit = relativeMatch[2]
    if (!Number.isNaN(value)) {
      if (unit.startsWith('сек')) {
        return new Date(referenceTimestamp - value * 1000)
      }
      if (unit.startsWith('мин')) {
        return new Date(referenceTimestamp - value * 60 * 1000)
      }
      if (unit.startsWith('час') || unit === 'ч') {
        return new Date(referenceTimestamp - value * 3600 * 1000)
      }
      if (unit.startsWith('дн') || unit.startsWith('ден')) {
        return new Date(referenceTimestamp - value * 86400 * 1000)
      }
    }
  }

  // 4. Одиночное время: "14:20", "09:05", "в 14:20" (типично для событий за сегодня в Народной карте)
  const timeOnlyMatch = text.match(/^(?:в\s*)?([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
  if (timeOnlyMatch) {
    const hours = Number.parseInt(timeOnlyMatch[1], 10)
    const minutes = Number.parseInt(timeOnlyMatch[2], 10)
    const d = new Date(referenceTimestamp)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  const refDate = new Date(referenceTimestamp)

  // 5. "сегодня [в/в,] HH:MM"
  const todayMatch = text.match(/(?:^|[^\wа-яё])сегодня[,\s]*(?:в\s*)?(\d{1,2}):(\d{2})/)
  if (todayMatch) {
    const hours = Number.parseInt(todayMatch[1], 10)
    const minutes = Number.parseInt(todayMatch[2], 10)
    const d = new Date(referenceTimestamp)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  // 6. "позавчера [в/в,] HH:MM"
  const dayBeforeMatch = text.match(/(?:^|[^\wа-яё])позавчера[,\s]*(?:в\s*)?(\d{1,2}):(\d{2})/)
  if (dayBeforeMatch) {
    const hours = Number.parseInt(dayBeforeMatch[1], 10)
    const minutes = Number.parseInt(dayBeforeMatch[2], 10)
    const d = new Date(referenceTimestamp - 2 * 86400 * 1000)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  // 7. "вчера [в/в,] HH:MM"
  const yesterdayMatch = text.match(/(?:^|[^\wа-яё])вчера[,\s]*(?:в\s*)?(\d{1,2}):(\d{2})/)
  if (yesterdayMatch) {
    const hours = Number.parseInt(yesterdayMatch[1], 10)
    const minutes = Number.parseInt(yesterdayMatch[2], 10)
    const d = new Date(referenceTimestamp - 86400 * 1000)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  // 8. Числовой формат "DD.MM.YYYY" или "DD.MM.YY" (опционально с HH:MM)
  const ddmmyyyyMatch = text.match(
    /(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:[,\s]+(?:в\s*)?(\d{1,2}):(\d{2}))?/,
  )
  if (ddmmyyyyMatch) {
    const day = Number.parseInt(ddmmyyyyMatch[1], 10)
    const month = Number.parseInt(ddmmyyyyMatch[2], 10) - 1
    let year = Number.parseInt(ddmmyyyyMatch[3], 10)
    if (year < 100) {
      year += 2000
    }
    const hours = ddmmyyyyMatch[4] ? Number.parseInt(ddmmyyyyMatch[4], 10) : 12
    const minutes = ddmmyyyyMatch[5] ? Number.parseInt(ddmmyyyyMatch[5], 10) : 0
    return new Date(year, month, day, hours, minutes, 0, 0)
  }

  // 9. Формат с названием месяца: "15 октября 2026 в 14:20" или "15 октября, 14:20" или "15 октября"
  // Защита от адресов объектов: если перед числом стоит "ул.", "пер.", "пр.", "д." и т.д., это адрес, а не дата!
  const monthMatch = text.match(
    /(?:^|[^а-яё0-9])(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:[,\s]+(?:в\s*)?(\d{1,2}):(\d{2}))?/i,
  )
  if (monthMatch && monthMatch.index !== undefined) {
    const matchStart = monthMatch.index
    const prefix = text.slice(Math.max(0, matchStart - 20), matchStart).trim()
    const isAddress =
      /(?:ул(?:ица|\.)?|пер(?:еулок|\.)?|просп(?:ект|\.)?|пр-т|бул(?:ьвар|\.)?|б-р|пл(?:ощадь|\.)?|шоссе|туп(?:ик|\.)?|наб(?:ережная|\.)?|д(?:ом|\.)?|корп(?:ус|\.)?|стр(?:оение|\.)?)$/i.test(
        prefix,
      )

    if (!isAddress) {
      const day = Number.parseInt(monthMatch[1], 10)
      const rawMonth = monthMatch[2].slice(0, 3)
      const month = RUSSIAN_MONTHS_MAP[rawMonth]
      if (month !== undefined) {
        const hasExplicitYear = Boolean(monthMatch[3])
        const hasExplicitTime = Boolean(monthMatch[4])

        // Если в строке только день и месяц без года и без времени, требуем, чтобы строка была компактной
        // (например, "15 октября"), а не длинным заголовком объекта
        if (hasExplicitYear || hasExplicitTime || text.length <= 30) {
          const year = monthMatch[3] ? Number.parseInt(monthMatch[3], 10) : refDate.getFullYear()
          const hours = monthMatch[4] ? Number.parseInt(monthMatch[4], 10) : 12
          const minutes = monthMatch[5] ? Number.parseInt(monthMatch[5], 10) : 0

          const candidate = new Date(year, month, day, hours, minutes, 0, 0)
          if (!monthMatch[3] && candidate.getTime() > referenceTimestamp + 2 * 86400 * 1000) {
            candidate.setFullYear(year - 1)
          }
          return candidate
        }
      }
    }
  }

  return null
}

/**
 * Извлекает и парсит дату из карточки события .nk-event-view.
 */
export const parseEventCardDate = (
  card: HTMLElement,
  referenceTimestamp = Date.now(),
): Date | null => {
  // 1. Проверяем data-атрибуты с timestamp
  const dataTimestamp =
    card.getAttribute('data-timestamp') ||
    card.getAttribute('data-time') ||
    card.getAttribute('data-date')
  if (dataTimestamp) {
    const tsNum = Number(dataTimestamp)
    if (!Number.isNaN(tsNum) && tsNum > 0) {
      return new Date(tsNum < 1e11 ? tsNum * 1000 : tsNum)
    }
    const parsedDate = parseEventDateString(dataTimestamp, referenceTimestamp)
    if (parsedDate) {
      return parsedDate
    }
  }

  // 2. Проверяем элемент <time datetime="...">
  const timeEl = card.querySelector<HTMLElement>('time[datetime], [datetime]')
  if (timeEl) {
    const dt = timeEl.getAttribute('datetime')
    if (dt) {
      const parsed = parseEventDateString(dt, referenceTimestamp)
      if (parsed) {
        return parsed
      }
    }
  }

  // 3. Проверяем специализированные классы времени в карточке
  // Исключаем заголовки и общие метаданные (.nk-event-view__header), чтобы не парсить названия улиц!
  const dateSelectors = [
    '.nk-event-view__time',
    '.nk-event-view__date',
    '[class*="event-view__time"]',
    '[class*="event-view__date"]',
    '[class*="relative-time"]',
    '[class*="event-view__timestamp"]',
    'time',
  ]

  for (const selector of dateSelectors) {
    const element = card.querySelector<HTMLElement>(selector)
    if (element) {
      const parsed =
        parseEventDateString(element.getAttribute('title') || '', referenceTimestamp) ||
        parseEventDateString(element.getAttribute('aria-label') || '', referenceTimestamp) ||
        parseEventDateString(element.textContent || '', referenceTimestamp)
      if (parsed) {
        return parsed
      }
    }
  }

  // 4. Резервный поиск по футеру карточки (где обычно размещаются метаданные)
  const footerEl = card.querySelector<HTMLElement>(
    '.nk-event-view__footer, [class*="event-view__footer"]',
  )
  if (footerEl) {
    const parsedFooter = parseEventDateString(footerEl.textContent || '', referenceTimestamp)
    if (parsedFooter) {
      return parsedFooter
    }
  }

  // 5. Крайний резерв по тексту карточки
  return parseEventDateString(card.textContent || '', referenceTimestamp)
}

/**
 * Извлекает текстовую строку давности из элемента даты карточки события.
 * Приоритетно ищет .nk-date-time.nk-event-view__date.
 */
export const getEventCardDateText = (card: HTMLElement): string => {
  const dateElement =
    card.querySelector<HTMLElement>(
      '.nk-date-time.nk-event-view__date, .nk-date-time_mode_relative, .nk-date-time, .nk-event-view__date, [class*="event-view__date"], [class*="relative-time"]',
    ) || card.querySelector<HTMLElement>('time')

  if (dateElement) {
    const directText = dateElement.textContent?.trim() || ''
    if (directText) {
      return directText
    }
    const title = dateElement.getAttribute('title')?.trim() || ''
    if (title) {
      return title
    }
    const ariaLabel = dateElement.getAttribute('aria-label')?.trim() || ''
    if (ariaLabel) {
      return ariaLabel
    }
  }

  return ''
}

/**
 * Определяет давность правки в полных днях (0 = сегодня, 1 = вчера, 2 = 2 дня назад и т.д.)
 * на основе формата Народной карты (nk-date-time nk-date-time_mode_relative nk-event-view__date).
 */
export const getEventCardDayAge = (
  card: HTMLElement,
  referenceTimestamp = Date.now(),
): number | null => {
  const rawText = getEventCardDateText(card).toLowerCase()
  if (!rawText) {
    const parsedDate = parseEventCardDate(card, referenceTimestamp)
    if (!parsedDate) {
      return null
    }
    const diffMs = referenceTimestamp - parsedDate.getTime()
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
  }

  // 1. "только что", "сегодня", изолированное время "HH:MM" или "в HH:MM" — давность 0 дней (сегодня)
  if (
    rawText.includes('только что') ||
    rawText.includes('сегодня') ||
    /^(?:в\s*)?[012]?\d:[0-5]\d(?::[0-5]\d)?$/.test(rawText)
  ) {
    return 0
  }

  // 2. Относительное время в секундах, минутах, часах
  const hourMinMatch = rawText.match(/(\d+)\s*(сек|мин|час|ч\b)\w*\s*назад/)
  if (hourMinMatch) {
    const val = Number.parseInt(hourMinMatch[1], 10)
    const unit = hourMinMatch[2]
    if (unit.startsWith('час') || unit === 'ч') {
      return val >= 24 ? Math.floor(val / 24) : 0
    }
    return 0
  }

  // 3. "позавчера" — давность 2 дня
  if (rawText.includes('позавчера')) {
    return 2
  }

  // 4. "вчера" — давность 1 день
  if (rawText.includes('вчера')) {
    return 1
  }

  // 5. "N дня/дней назад" — давность N дней
  const daysAgoMatch = rawText.match(/(\d+)\s*(?:дн|ден)\w*\s*назад/)
  if (daysAgoMatch) {
    const days = Number.parseInt(daysAgoMatch[1], 10)
    if (!Number.isNaN(days)) {
      return days
    }
  }

  // 6. Календарные даты ("14 октября", "10.10.2026")
  const parsed = parseEventDateString(rawText, referenceTimestamp)
  if (parsed) {
    const refDate = new Date(referenceTimestamp)
    refDate.setHours(0, 0, 0, 0)
    const cardDate = new Date(parsed.getTime())
    cardDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((refDate.getTime() - cardDate.getTime()) / (24 * 60 * 60 * 1000))
    return Math.max(0, diffDays)
  }

  return null
}

/**
 * Находит последнюю карточку с известной давностью в днях, сканируя список карточек с конца.
 */
export const getLastCardWithDayAge = (
  cards: HTMLElement[],
  referenceTimestamp = Date.now(),
): { card: HTMLElement; dayAge: number } | null => {
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i]
    if (
      card.classList.contains('nk-event-view_skeleton') ||
      card.classList.contains('nk-spinner') ||
      card.getAttribute('aria-hidden') === 'true'
    ) {
      continue
    }
    const dayAge = getEventCardDayAge(card, referenceTimestamp)
    if (dayAge !== null) {
      return { card, dayAge }
    }
  }
  return null
}

/**
 * Находит все потенциально скроллируемые контейнеры для ленты событий.
 */
export const getAllScrollableContainers = (feedContainer: HTMLElement): HTMLElement[] => {
  const containers = new Set<HTMLElement>()

  // 1. Сам feedContainer и все его предки
  let current: HTMLElement | null = feedContainer
  while (current && current !== document.documentElement) {
    containers.add(current)
    current = current.parentElement
  }

  // 2. Внутренние элементы со скроллом
  feedContainer
    .querySelectorAll<HTMLElement>(
      '.nk-scrollable, .nk-scrollable__content, [class*="scrollable"], .nk-list, .nk-sidebar-view__body',
    )
    .forEach((el) => {
      containers.add(el)
    })

  // 3. Родители карточек
  const cards = feedContainer.querySelectorAll<HTMLElement>('.nk-event-view, [class*="event-view"]')
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1]
    if (lastCard.parentElement) {
      containers.add(lastCard.parentElement)
      if (lastCard.parentElement.parentElement) {
        containers.add(lastCard.parentElement.parentElement)
      }
    }
  }

  // Фильтруем элементы, которые могут скроллиться
  const scrollable: HTMLElement[] = []
  for (const el of containers) {
    const style = typeof window !== 'undefined' ? window.getComputedStyle(el) : null
    const overflowY = style?.overflowY
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      el.scrollHeight > el.clientHeight ||
      el.classList.contains('nk-scrollable') ||
      el.classList.contains('nk-scrollable__content')
    ) {
      scrollable.push(el)
    }
  }

  if (scrollable.length === 0) {
    scrollable.push(feedContainer)
  }

  return scrollable
}

/**
 * Находит основной скроллируемый контейнер для ленты событий.
 */
export const findFeedScrollableContainer = (feedContainer: HTMLElement): HTMLElement => {
  // 1. Ищем элемент с явным scrollHeight > clientHeight и overflow auto/scroll
  const all = getAllScrollableContainers(feedContainer)
  const activeScroll = all.find(
    (el) =>
      el.scrollHeight > el.clientHeight &&
      typeof window !== 'undefined' &&
      (window.getComputedStyle(el).overflowY === 'auto' ||
        window.getComputedStyle(el).overflowY === 'scroll'),
  )
  if (activeScroll) {
    return activeScroll
  }

  // 2. Ищем внутренний .nk-scrollable или .nk-scrollable__content
  const scrollChild = feedContainer.querySelector<HTMLElement>(
    '.nk-scrollable, .nk-scrollable__content, [class*="scrollable"]',
  )
  if (scrollChild) {
    return scrollChild
  }

  return feedContainer
}

/**
 * Программно триггерит дозагрузку следующей порции событий ленты через прокрутку.
 */
export const triggerFeedScrollLoad = (feedContainer: HTMLElement): void => {
  // 1. Нативный скролл последней карточки в видимую зону (гарантированно сдвигает реальный скроллбар)
  const cards = feedContainer.querySelectorAll<HTMLElement>('.nk-event-view, [class*="event-view"]')
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1]
    try {
      if (typeof lastCard.scrollIntoView === 'function') {
        lastCard.scrollIntoView({ behavior: 'auto', block: 'end' })
      }
    } catch {
      // Игнорируем в тестовых средах без нативного scrollIntoView
    }
  }

  // 2. Прокрутка всех найденных скролл-контейнеров
  const targets = getAllScrollableContainers(feedContainer)
  for (const target of targets) {
    const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight)
    if (maxScroll > 0) {
      target.scrollTop = Math.max(0, maxScroll - 30)
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
      target.scrollTop = maxScroll
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
    } else {
      target.scrollTop = target.scrollHeight
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
    }

    try {
      if (typeof WheelEvent !== 'undefined') {
        const wheelEvt = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: 600,
        })
        target.dispatchEvent(wheelEvt)
      }
    } catch {
      // Игнорируем в средах без WheelEvent
    }
  }

  // 3. Клик по кнопке "Показать еще" / "Загрузить еще" (если есть)
  const moreButton = feedContainer.querySelector<HTMLElement>(
    'button.nk-button, .nk-user-feeds-view__more, [class*="more-button"], [class*="load-more"]',
  )
  if (moreButton && /ещ[её]|дальше|больше|load\s*more/i.test(moreButton.textContent || '')) {
    moreButton.click()
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('scroll'))
  }
}

/**
 * Рассчитывает целевой временной порог (в мс) для N суток.
 * Гарантирует покрытие всех правок текущего календарного дня (с 00:00:00) и не менее 24 часов.
 */
export const getTargetThresholdMs = (
  targetDays: number,
  referenceTimestamp = Date.now(),
): number => {
  const startOfToday = new Date(referenceTimestamp)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTodayMs = startOfToday.getTime()

  const daysAgoMs = referenceTimestamp - targetDays * 24 * 60 * 60 * 1000
  const calendarDaysAgoMs = startOfTodayMs - (targetDays - 1) * 24 * 60 * 60 * 1000

  return Math.min(calendarDaysAgoMs, daysAgoMs)
}

/**
 * Находит последнюю карточку с валидной датой, сканируя список карточек с конца.
 */
export const getLastCardWithDate = (
  cards: HTMLElement[],
  referenceTimestamp = Date.now(),
): { card: HTMLElement; date: Date } | null => {
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i]
    if (
      card.classList.contains('nk-event-view_skeleton') ||
      card.classList.contains('nk-spinner') ||
      card.getAttribute('aria-hidden') === 'true'
    ) {
      continue
    }
    const date = parseEventCardDate(card, referenceTimestamp)
    if (date) {
      return { card, date }
    }
  }
  return null
}

export interface FeedDailyLoaderOptions {
  maxStepsPerDay?: number
  stepDelayMs?: number
  onProgress?: (loadedCount: number, targetDays: number) => void
}

export interface FeedDailyLoaderController {
  loadUpToDays: (days: number) => Promise<boolean>
  getLoadedDaysCount: () => number
  isLoading: () => boolean
  teardown: () => void
}

/**
 * Создает контроллер автоматической загрузки событий ленты за сутки.
 * При открытии ленты подгружает события за текущие сутки (не менее 24 часов).
 * При скролле вниз автоматически догружает очередные сутки.
 */
export const createFeedDailyLoader = (
  feedContainer: HTMLElement,
  options?: FeedDailyLoaderOptions,
): FeedDailyLoaderController => {
  const openedTimestamp = Date.now()
  let loadedDaysCount = 1
  let isCurrentlyLoading = false
  let isAllHistoryLoaded = false
  let isTeardown = false

  const scrollContainer = findFeedScrollableContainer(feedContainer)

  const waitForNewCards = (
    container: HTMLElement,
    previousCount: number,
    timeoutMs = 3500,
  ): Promise<number> => {
    return new Promise((resolve) => {
      let isResolved = false
      let timer: ReturnType<typeof setTimeout> | null = null
      let observer: MutationObserver | null = null

      const finish = (count: number) => {
        if (isResolved) {
          return
        }
        isResolved = true
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        if (observer) {
          observer.disconnect()
          observer = null
        }
        resolve(count)
      }

      timer = setTimeout(() => {
        const currentCards = getEventCards(container)
        finish(currentCards.length)
      }, timeoutMs)

      if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(() => {
          const currentCards = getEventCards(container)
          if (currentCards.length > previousCount) {
            finish(currentCards.length)
          }
        })
        observer.observe(container, { childList: true, subtree: true })
      }
    })
  }

  const loadUpToDays = async (targetDays: number): Promise<boolean> => {
    if (isCurrentlyLoading || isAllHistoryLoaded || isTeardown) {
      return false
    }

    isCurrentlyLoading = true
    const maxSteps = options?.maxStepsPerDay ?? 60
    const stepDelayMs = options?.stepDelayMs ?? 200
    const targetThresholdMs = getTargetThresholdMs(targetDays, openedTimestamp)

    try {
      let currentStep = 0
      let consecutiveStalls = 0
      const maxStalls = 3

      while (currentStep < maxSteps && !isTeardown) {
        const cards = getEventCards(feedContainer)
        if (cards.length === 0) {
          triggerFeedScrollLoad(feedContainer)
          const newCount = await waitForNewCards(feedContainer, 0, 2500)
          if (newCount === 0) {
            consecutiveStalls += 1
            if (consecutiveStalls >= maxStalls) {
              isAllHistoryLoaded = true
              break
            }
          } else {
            consecutiveStalls = 0
          }
          continue
        }

        // 1. Приоритетная проверка по дням Народной карты (nk-date-time nk-date-time_mode_relative)
        const lastDayInfo = getLastCardWithDayAge(cards, openedTimestamp)
        if (lastDayInfo && lastDayInfo.dayAge >= targetDays) {
          // Для targetDays = 1 (сегодня): встретилось "вчера" (dayAge >= 1) — все события за сегодня уже загружены!
          // Для targetDays = 2 (2 суток): встретилось "2 дня назад" (dayAge >= 2) — все события за 2 суток загружены!
          break
        }

        // 2. Резервная проверка по миллисекундам даты
        const lastDateInfo = getLastCardWithDate(cards, openedTimestamp)
        if (lastDateInfo && lastDateInfo.date.getTime() < targetThresholdMs) {
          break
        }

        currentStep += 1
        options?.onProgress?.(cards.length, targetDays)

        const prevCardCount = cards.length
        triggerFeedScrollLoad(feedContainer)

        const nextCardCount = await waitForNewCards(feedContainer, prevCardCount, 3500)
        if (nextCardCount <= prevCardCount) {
          consecutiveStalls += 1
          // Повторный альтернативный триггер
          triggerFeedScrollLoad(feedContainer)

          if (consecutiveStalls >= maxStalls) {
            if (lastDayInfo && lastDayInfo.dayAge >= targetDays) {
              break
            }
            if (lastDateInfo && lastDateInfo.date.getTime() < targetThresholdMs) {
              break
            }
            break
          }
        } else {
          consecutiveStalls = 0
        }

        if (stepDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, stepDelayMs))
        }
      }

      loadedDaysCount = Math.max(loadedDaysCount, targetDays)
      return true
    } finally {
      isCurrentlyLoading = false
    }
  }

  const handleScroll = (): void => {
    if (isCurrentlyLoading || isAllHistoryLoaded || isTeardown) {
      return
    }

    const isNearBottom =
      scrollContainer.scrollTop + scrollContainer.clientHeight >=
        scrollContainer.scrollHeight - 250 ||
      feedContainer.scrollTop + feedContainer.clientHeight >= feedContainer.scrollHeight - 250

    if (isNearBottom) {
      const nextDays = loadedDaysCount + 1
      void loadUpToDays(nextDays)
    }
  }

  feedContainer.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  scrollContainer.addEventListener('scroll', handleScroll, { passive: true })

  // Инициализация: загрузка правок за первые сутки при открытии ленты
  void loadUpToDays(1)

  const teardown = (): void => {
    isTeardown = true
    feedContainer.removeEventListener('scroll', handleScroll, { capture: true })
    scrollContainer.removeEventListener('scroll', handleScroll)
  }

  return {
    loadUpToDays,
    getLoadedDaysCount: () => loadedDaysCount,
    isLoading: () => isCurrentlyLoading,
    teardown,
  }
}
