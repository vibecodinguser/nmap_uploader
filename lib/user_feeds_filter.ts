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
 * Возвращает сохраненное состояние активности фильтра истории правок (по умолчанию включен).
 */
export const getStoredFeedsFilterEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(FEEDS_FILTER_ENABLED_STORAGE_KEY)
  const value = stored[FEEDS_FILTER_ENABLED_STORAGE_KEY]
  return value === undefined ? true : Boolean(value)
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
 * Ищет целевой селект nk-select размера m темы islands в интерфейсе Народной карты.
 */
export const findTargetSelect = (container?: HTMLElement | null): HTMLElement | null => {
  const notMeSelector = `:not(#${FEEDS_FILTER_SELECT_ID})`
  const baseSelector = `.nk-select.nk-select_theme_islands.nk-select_size_m${notMeSelector}`

  if (container) {
    const inContainer = container.querySelector<HTMLElement>(baseSelector)
    if (inContainer) {
      return inContainer
    }
  }

  return (
    document.querySelector<HTMLElement>(`.nk-user-feeds-view ${baseSelector}`) ||
    document.querySelector<HTMLElement>(`.nk-sidebar-view ${baseSelector}`) ||
    document.querySelector<HTMLElement>(`[class*="user-feeds"] ${baseSelector}`) ||
    document.querySelector<HTMLElement>(baseSelector)
  )
}

/**
 * Измеряет высоту целевого nk-select и синхронизирует высоту кнопки дропдауна фильтра.
 * Копирует точную высоту соседнего селекта (в px), предотвращая расхождение размеров.
 */
export const syncFilterDropdownHeight = (
  dropdownElement: HTMLElement,
  referenceSelect?: HTMLElement | null,
): number => {
  const target = referenceSelect || findTargetSelect()
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
 * Ищет целевой селект nk-select в интерфейсе Народной карты (например, выбор типа объекта/категории)
 * и размещает дропдаун фильтра статусов рядом с ним с синхронизацией точной высоты.
 */
export const attachFilterDropdownToDom = (
  dropdownElement: HTMLElement,
  container: HTMLElement,
): boolean => {
  const targetSelect = findTargetSelect(container)

  if (targetSelect) {
    if (targetSelect.nextElementSibling !== dropdownElement) {
      targetSelect.insertAdjacentElement('afterend', dropdownElement)
    }
    syncFilterDropdownHeight(dropdownElement, targetSelect)
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        syncFilterDropdownHeight(dropdownElement, targetSelect)
      })
    }
    return true
  }

  // Резервное размещение: если целевой селект еще не отрендерен, крепим в начало контейнера
  if (dropdownElement.parentElement !== container) {
    container.prepend(dropdownElement)
  }
  syncFilterDropdownHeight(dropdownElement)
  return false
}

/**
 * Находит корневой контейнер ленты правок/событий в DOM.
 */
export const findFeedContainer = (root: ParentNode = document): HTMLElement | null => {
  // 1. Проверяем наличие карточек событий и их общего предка
  const eventCards =
    root instanceof HTMLElement
      ? getEventCards(root)
      : Array.from(root.querySelectorAll<HTMLElement>('.nk-event-view'))
  const eventCard = eventCards[0]
  if (eventCard) {
    const parentContainer =
      eventCard.closest<HTMLElement>('.nk-user-feeds-view') ||
      eventCard.closest<HTMLElement>('.nk-sidebar-view') ||
      eventCard.closest<HTMLElement>('.nk-events-view') ||
      eventCard.closest<HTMLElement>('[class*="user-feeds"]') ||
      eventCard.closest<HTMLElement>('[class*="scrollable"]') ||
      eventCard.parentElement

    if (parentContainer) {
      return parentContainer
    }
  }

  // 2. Проверяем наличие специализированного класса ленты пользователя
  const knownView =
    root.querySelector<HTMLElement>('.nk-user-feeds-view') ||
    root.querySelector<HTMLElement>('.nk-events-view') ||
    root.querySelector<HTMLElement>('[class*="user-feeds-view"]')

  if (knownView) {
    return knownView
  }

  return null
}
