import { DEFAULT_HISTORY_PERIOD_DAYS, FEEDS_FILTER_SELECT_ID } from './constants'
import type { FeedStats, FeedStatusId } from './core'
import {
  createDropdownButtonElements,
  setDropdownButtonLoading,
  updateDropdownButtonDisplay,
} from './dropdown_button_builder'
import { createDropdownMenu, type DropdownPeriodDisplayState } from './dropdown_menu_builder'
import { hidePopup, positionPopupFixed } from './dropdown_popup_position'
import { syncFilterDropdownHeight } from './dropdown_theme'

export * from './dropdown_button_builder'
export * from './dropdown_menu_builder'
export * from './dropdown_popup_position'
export * from './dropdown_styles'
export * from './dropdown_theme'

export interface FilterDropdownOptions {
  initialDays?: number
  onPeriodChange?: (days: number) => void
  onStopLoading?: () => void
}

export interface FilterDropdownController {
  element: HTMLElement
  popupElement: HTMLElement
  updateCounters: (stats: FeedStats) => void
  setActiveFilter: (status: FeedStatusId) => void
  setLoadingState: (isLoading: boolean) => void
  updatePeriodState: (state: DropdownPeriodDisplayState) => void
  syncHeight: (referenceSelect?: HTMLElement | null) => number
  teardown: () => void
}

export const createFilterDropdownElement = (
  onFilterChange: (status: FeedStatusId) => void,
  initialFilter: FeedStatusId = 'all',
  options?: FilterDropdownOptions,
): FilterDropdownController => {
  const { selectHost, button, buttonLabel, buttonCount, buttonIcon, buttonSpinner } =
    createDropdownButtonElements(FEEDS_FILTER_SELECT_ID)

  let isPopupOpen = false
  let currentSelectedStatus = initialFilter
  let latestStats: FeedStats = { total: 0, published: 0, green: 0, yellow: 0, red: 0 }

  const handleSelectOption = (status: FeedStatusId): void => {
    setActiveFilter(status)
    closePopup()
    onFilterChange(status)
  }

  const {
    popupElement: popup,
    itemMap,
    updatePeriodDisplay,
  } = createDropdownMenu({
    initialFilter,
    initialDays: options?.initialDays ?? DEFAULT_HISTORY_PERIOD_DAYS,
    onSelect: handleSelectOption,
    onSelectPeriod: options?.onPeriodChange,
    onStopLoading: options?.onStopLoading,
  })

  const openPopup = (): void => {
    if (!popup.parentElement) {
      document.body.appendChild(popup)
    }

    for (let i = 0; i < selectHost.style.length; i++) {
      const prop = selectHost.style[i]
      if (prop.startsWith('--nmap-feeds-')) {
        popup.style.setProperty(prop, selectHost.style.getPropertyValue(prop))
      }
    }

    positionPopupFixed({ referenceElement: button, popupElement: popup })

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

    hidePopup(popup)
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
    updateDropdownButtonDisplay({ buttonLabel, buttonCount, buttonIcon }, status, latestStats)
  }

  const setActiveFilter = (status: FeedStatusId): void => {
    currentSelectedStatus = status

    itemMap.forEach(({ itemElement }, id) => {
      const isChecked = id === status
      itemElement.classList.toggle('nk-menu__item_checked', isChecked)
      itemElement.classList.toggle('nk-menu-item_checked', isChecked)
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

  const setLoadingState = (isLoading: boolean): void => {
    setDropdownButtonLoading({ buttonSpinner }, isLoading)
  }

  const updatePeriodState = (state: DropdownPeriodDisplayState): void => {
    updatePeriodDisplay(state)
  }

  const syncHeight = (referenceSelect?: HTMLElement | null): number => {
    return syncFilterDropdownHeight(selectHost, referenceSelect, popup)
  }

  syncFilterDropdownHeight(selectHost, null, popup)
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
    setLoadingState,
    updatePeriodState,
    syncHeight,
    teardown,
  }
}
