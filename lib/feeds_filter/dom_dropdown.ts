import { parseStaticSvg } from '@/lib/parse_static_svg'
import {
  FEED_HIDDEN_CLASS,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  FEEDS_FILTER_STYLES_ID,
  STATUS_FILTER_OPTIONS,
} from './constants'
import type { FeedStats, FeedStatusId } from './core'

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
      height: var(--nmap-feeds-select-height, 28px) !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 10 !important;
    }
    .nmap-feeds-status-select .nk-select__button {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      width: 100% !important;
      height: var(--nmap-feeds-select-height, 28px) !important;
      min-height: var(--nmap-feeds-select-height, 28px) !important;
      max-height: var(--nmap-feeds-select-height, 28px) !important;
      line-height: var(--nmap-feeds-select-height, 28px) !important;
      padding: 0 25px 0 0 !important;
      border: var(--nmap-feeds-select-border, 1px solid rgba(255, 255, 255, 0.4)) !important;
      border-radius: var(--nmap-feeds-select-radius, 4px) !important;
      outline: 0 !important;
      background: var(--nmap-feeds-select-bg, transparent) !important;
      background-color: var(--nmap-feeds-select-bg, transparent) !important;
      color: var(--nmap-feeds-select-color, inherit) !important;
      font-size: 13px !important;
      font-family: inherit !important;
      cursor: pointer !important;
      box-sizing: border-box !important;
      white-space: nowrap !important;
      user-select: none !important;
      pointer-events: auto !important;
      text-align: left !important;
      vertical-align: top !important;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .nmap-feeds-status-select .nk-select__button::before {
      display: none !important;
    }
    .nmap-feeds-status-select .nk-select__button:hover {
      background: var(--nmap-feeds-select-hover-bg, rgba(255, 255, 255, 0.08)) !important;
      border-color: var(--nmap-feeds-select-hover-border, rgba(255, 255, 255, 0.6)) !important;
    }
    .nmap-feeds-status-select.nk-select_opened .nk-select__button,
    .nmap-feeds-status-select .nk-select__button:focus {
      background: var(--nmap-feeds-select-focus-bg, rgba(255, 255, 255, 0.12)) !important;
      border-color: #ffcc00 !important;
      box-shadow: 0 0 0 1px #ffcc00, inset 0 0 0 1px #ffcc00 !important;
    }
    .nmap-feeds-status-select .nk-select__text {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin: 0 0 0 10px !important;
      height: 100% !important;
      line-height: inherit !important;
      pointer-events: none !important;
      z-index: 1 !important;
      vertical-align: top !important;
      color: inherit !important;
    }
    .nmap-feeds-status-select .nk-select__tick {
      position: absolute !important;
      top: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 25px !important;
      height: 100% !important;
      pointer-events: none !important;
      z-index: 1 !important;
      background-image: var(
        --nmap-feeds-select-tick,
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='6'%3E%3Cpath fill='%23fff' d='M10.3 0L5.5 4.7.7 0 0 .7 5.5 6 11 .7z'/%3E%3C/svg%3E")
      ) !important;
      background-repeat: no-repeat !important;
      background-position: center center !important;
      transition: transform 0.15s ease-out !important;
    }
    .nmap-feeds-status-select.nk-select_opened .nk-select__tick {
      transform: rotate(180deg) !important;
    }
    .nmap-feeds-status-popup {
      position: fixed !important;
      z-index: 2147483647 !important;
      min-width: 175px !important;
      background: var(--nmap-feeds-popup-bg, #2b2b2b) !important;
      color: var(--nmap-feeds-popup-color, #ffffff) !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45) !important;
      border: 1px solid var(--nmap-feeds-popup-border, rgba(255, 255, 255, 0.15)) !important;
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
      color: inherit !important;
      transition: background-color 0.1s ease !important;
    }
    .nmap-feeds-status-popup .nk-menu__item:hover {
      background-color: var(--nmap-feeds-popup-hover-bg, rgba(255, 255, 255, 0.08)) !important;
    }
    .nmap-feeds-status-popup .nk-menu__item_checked {
      background-color: var(--nmap-feeds-popup-checked-bg, rgba(255, 255, 255, 0.15)) !important;
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
      width: 22px !important;
      height: 22px !important;
      min-width: 22px !important;
      min-height: 22px !important;
      margin: 0 !important;
      padding: 0 !important;
      flex-shrink: 0 !important;
      vertical-align: middle !important;
      background: transparent !important;
    }
    .nmap-feeds-status-select .nk-commit-state-view svg,
    .nmap-feeds-status-popup .nk-commit-state-view svg {
      display: block !important;
      width: 22px !important;
      height: 22px !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
    }
    .nmap-status-count-badge {
      margin-left: auto !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      padding: 1px 6px !important;
      border-radius: 10px !important;
      background: var(--nmap-feeds-badge-bg, rgba(255, 255, 255, 0.16)) !important;
      color: inherit !important;
    }
  `
  document.head.appendChild(styleEl)
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
 * Измеряет высоту целевого nk-select и синхронизирует высоту кнопки дропдауна фильтра.
 */
export const syncFilterDropdownHeight = (
  dropdownElement: HTMLElement,
  referenceSelect?: HTMLElement | null,
): number => {
  const target = referenceSelect
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

  if (target && typeof window !== 'undefined') {
    const targetButton =
      target.querySelector<HTMLElement>(
        'button.nk-select__button, button.nk-button, .nk-select__button',
      ) || target
    const targetComputed = window.getComputedStyle(targetButton)

    const color = targetComputed.color
    if (color) {
      dropdownElement.style.setProperty('--nmap-feeds-select-color', color)
      dropdownElement.style.setProperty('--nmap-feeds-popup-color', color)
    }

    const borderRadius = targetComputed.borderRadius
    if (borderRadius && borderRadius !== '0px') {
      dropdownElement.style.setProperty('--nmap-feeds-select-radius', borderRadius)
    }

    const borderColor = targetComputed.borderColor
    const borderWidth = targetComputed.borderWidth
    const borderStyle = targetComputed.borderStyle
    if (
      borderColor &&
      borderWidth &&
      borderStyle &&
      borderStyle !== 'none' &&
      borderWidth !== '0px'
    ) {
      dropdownElement.style.setProperty(
        '--nmap-feeds-select-border',
        `${borderWidth} ${borderStyle} ${borderColor}`,
      )
    }

    const backgroundColor = targetComputed.backgroundColor
    if (backgroundColor) {
      dropdownElement.style.setProperty('--nmap-feeds-select-bg', backgroundColor)
    }

    const isLightText =
      color.includes('255, 255, 255') ||
      color.includes('rgba(255') ||
      color === 'rgb(255, 255, 255)' ||
      color === '#ffffff' ||
      color === '#ededed'

    if (!isLightText && color && color !== 'inherit') {
      dropdownElement.style.setProperty(
        '--nmap-feeds-select-tick',
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='6'%3E%3Cpath fill='%23000' d='M10.3 0L5.5 4.7.7 0 0 .7 5.5 6 11 .7z'/%3E%3C/svg%3E\")",
      )
      dropdownElement.style.setProperty('--nmap-feeds-popup-bg', '#ffffff')
      dropdownElement.style.setProperty('--nmap-feeds-popup-color', '#000000')
      dropdownElement.style.setProperty('--nmap-feeds-popup-border', 'rgba(0, 0, 0, 0.15)')
      dropdownElement.style.setProperty('--nmap-feeds-popup-hover-bg', 'rgba(0, 0, 0, 0.05)')
      dropdownElement.style.setProperty('--nmap-feeds-popup-checked-bg', 'rgba(0, 0, 0, 0.08)')
      dropdownElement.style.setProperty('--nmap-feeds-badge-bg', 'rgba(0, 0, 0, 0.08)')
    }
  }

  return effectiveHeight
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
    item.className = `nk-menu__item nk-menu__item_theme_islands ${
      opt.id === initialFilter ? 'nk-menu__item_checked' : ''
    }`
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
