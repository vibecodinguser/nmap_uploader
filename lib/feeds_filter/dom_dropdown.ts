import { parseStaticSvg } from '@/lib/parse_static_svg'
import { FEEDS_FILTER_POPUP_ID, FEEDS_FILTER_SELECT_ID, STATUS_FILTER_OPTIONS } from './constants'
import type { FeedStats, FeedStatusId } from './core'
import { syncFilterDropdownHeight } from './dropdown_theme'

export * from './dropdown_styles'
export * from './dropdown_theme'

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
