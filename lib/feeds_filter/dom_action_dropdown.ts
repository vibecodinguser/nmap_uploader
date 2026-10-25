import {
  ACTION_FILTER_OPTIONS,
  FEEDS_ACTION_FILTER_POPUP_ID,
  FEEDS_ACTION_FILTER_SELECT_ID,
} from './constants'
import type { FeedActionId, FeedActionsStats } from './core'
import { hidePopup, positionPopupFixed } from './dropdown_popup_position'
import { syncFilterDropdownHeight } from './dropdown_theme'

export interface ActionFilterDropdownController {
  element: HTMLElement
  popupElement: HTMLElement
  updateCounters: (stats: FeedActionsStats) => void
  setActiveFilter: (action: FeedActionId) => void
  syncHeight: (referenceSelect?: HTMLElement | null) => number
  teardown: () => void
}

/**
 * Создает DOM-структуру селекта фильтра действий правок.
 */
export const createActionDropdownButtonElements = (selectId: string) => {
  const selectHost = document.createElement('span')
  selectHost.id = selectId
  selectHost.className =
    'nk-select nk-select_theme_islands nk-select_size_m nmap-feeds-status-select nmap-feeds-action-select'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
  button.setAttribute('aria-haspopup', 'listbox')
  button.setAttribute('aria-expanded', 'false')
  button.setAttribute('aria-label', 'Фильтр по действию правок')

  const textSpan = document.createElement('span')
  textSpan.className = 'nk-button__text nk-select__text'

  const buttonMarker = document.createElement('span')
  buttonMarker.className = 'nmap-action-marker nmap-hidden'
  buttonMarker.setAttribute('hidden', 'true')
  buttonMarker.setAttribute('aria-hidden', 'true')
  textSpan.appendChild(buttonMarker)

  const buttonLabel = document.createElement('span')
  buttonLabel.className = 'nmap-feeds-button-label'
  buttonLabel.textContent = 'Все действия'
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

  return { selectHost, button, buttonLabel, buttonCount, buttonMarker }
}

/**
 * Создает выпадающее меню действий.
 */
export const createActionDropdownMenu = ({
  initialFilter,
  onSelect,
}: {
  initialFilter: FeedActionId
  onSelect: (action: FeedActionId) => void
}) => {
  const popup = document.createElement('div')
  popup.id = FEEDS_ACTION_FILTER_POPUP_ID
  popup.className =
    'nk-popup nk-popup_theme_islands nk-popup_restrict-height nmap-feeds-status-popup nmap-feeds-action-popup'
  popup.style.display = 'none'

  const sizeObserver = document.createElement('div')
  sizeObserver.className = 'nk-size-observer'
  popup.appendChild(sizeObserver)

  const popupContent = document.createElement('div')
  popupContent.className = 'nk-popup__content'
  sizeObserver.appendChild(popupContent)

  const menu = document.createElement('div')
  menu.className = 'nk-menu nk-menu_theme_islands nk-menu_mode_radio nk-menu_size_m nk-select__menu'
  menu.setAttribute('role', 'listbox')
  menu.setAttribute('tabindex', '0')
  popupContent.appendChild(menu)

  const itemMap = new Map<FeedActionId, { itemElement: HTMLElement; countBadge: HTMLSpanElement }>()

  ACTION_FILTER_OPTIONS.forEach((opt) => {
    const item = document.createElement('div')
    item.className = `nk-menu-item nk-menu__item nk-menu-item_theme_islands nk-menu-item_size_m nk-select__option ${
      opt.id === initialFilter ? 'nk-menu-item_checked nk-menu__item_checked' : ''
    }`
    item.dataset.action = opt.id
    item.setAttribute('role', 'option')
    item.setAttribute('aria-selected', opt.id === initialFilter ? 'true' : 'false')

    if (opt.color) {
      const marker = document.createElement('span')
      marker.className = 'nmap-action-marker'
      marker.style.backgroundColor = opt.color
      marker.setAttribute('aria-hidden', 'true')
      item.appendChild(marker)
    }

    const label = document.createElement('span')
    label.className = 'nk-menu__text'
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
        onSelect(opt.id)
      },
      true,
    )

    itemMap.set(opt.id, { itemElement: item, countBadge: badge })
    menu.appendChild(item)
  })

  return { popupElement: popup, menuElement: menu, itemMap }
}

/**
 * Создает контроллер выпадающего селекта действий правок.
 */
export const createActionFilterDropdownElement = (
  onFilterChange: (action: FeedActionId) => void,
  initialFilter: FeedActionId = 'all',
): ActionFilterDropdownController => {
  const { selectHost, button, buttonLabel, buttonCount, buttonMarker } =
    createActionDropdownButtonElements(FEEDS_ACTION_FILTER_SELECT_ID)

  let isPopupOpen = false
  let currentSelectedAction = initialFilter
  let latestStats: FeedActionsStats = { total: 0, delete: 0, edit: 0, create: 0 }

  const handleSelectOption = (action: FeedActionId): void => {
    setActiveFilter(action)
    closePopup()
    onFilterChange(action)
  }

  const { popupElement: popup, itemMap } = createActionDropdownMenu({
    initialFilter,
    onSelect: handleSelectOption,
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

  const syncButtonDisplay = (action: FeedActionId): void => {
    const option = ACTION_FILTER_OPTIONS.find((opt) => opt.id === action)
    if (!option) {
      return
    }

    buttonLabel.textContent = option.label

    if (option.color) {
      buttonMarker.style.backgroundColor = option.color
      buttonMarker.classList.remove('nmap-hidden')
      buttonMarker.removeAttribute('hidden')
      buttonMarker.style.display = 'inline-block'
    } else {
      buttonMarker.classList.add('nmap-hidden')
      buttonMarker.setAttribute('hidden', 'true')
      buttonMarker.style.display = 'none'
    }

    let countValue = latestStats.total
    if (action === 'delete') countValue = latestStats.delete
    else if (action === 'create') countValue = latestStats.create
    else if (action === 'edit') countValue = latestStats.edit

    buttonCount.textContent = String(countValue)
  }

  const setActiveFilter = (action: FeedActionId): void => {
    currentSelectedAction = action

    itemMap.forEach(({ itemElement }, id) => {
      const isChecked = id === action
      itemElement.classList.toggle('nk-menu__item_checked', isChecked)
      itemElement.classList.toggle('nk-menu-item_checked', isChecked)
      itemElement.setAttribute('aria-selected', isChecked ? 'true' : 'false')
    })

    syncButtonDisplay(action)
  }

  const updateCounters = (stats: FeedActionsStats): void => {
    latestStats = stats

    const allItem = itemMap.get('all')
    if (allItem) allItem.countBadge.textContent = String(stats.total)

    const deleteItem = itemMap.get('delete')
    if (deleteItem) deleteItem.countBadge.textContent = String(stats.delete)

    const editItem = itemMap.get('edit')
    if (editItem) editItem.countBadge.textContent = String(stats.edit)

    const createItem = itemMap.get('create')
    if (createItem) createItem.countBadge.textContent = String(stats.create)

    syncButtonDisplay(currentSelectedAction)
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
    syncHeight,
    teardown,
  }
}
