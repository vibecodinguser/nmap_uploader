import { parseStaticSvg } from '@/lib/parse_static_svg'
import {
  DEFAULT_HISTORY_PERIOD_DAYS,
  FEEDS_FILTER_POPUP_ID,
  HISTORY_PERIOD_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from './constants'
import type { FeedStatusId } from './core'

export interface DropdownMenuItemState {
  itemElement: HTMLElement
  countBadge: HTMLSpanElement
}

export interface DropdownPeriodDisplayState {
  activeDays: number
  targetDays?: number
  isLoading: boolean
  loadedCardsCount: number
}

export interface DropdownMenuComponent {
  popupElement: HTMLElement
  menuElement: HTMLElement
  itemMap: Map<FeedStatusId, DropdownMenuItemState>
  updatePeriodDisplay: (state: DropdownPeriodDisplayState) => void
}

export interface DropdownMenuOptions {
  initialFilter: FeedStatusId
  initialDays?: number
  onSelect: (status: FeedStatusId) => void
  onSelectPeriod?: (days: number) => void
  onStopLoading?: () => void
}

export const createDropdownMenu = ({
  initialFilter,
  initialDays = DEFAULT_HISTORY_PERIOD_DAYS,
  onSelect,
  onSelectPeriod,
  onStopLoading,
}: DropdownMenuOptions): DropdownMenuComponent => {
  const popup = document.createElement('div')
  popup.id = FEEDS_FILTER_POPUP_ID
  popup.className =
    'nk-popup nk-popup_theme_islands nk-popup_restrict-height nmap-feeds-status-popup'
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

  const itemMap = new Map<FeedStatusId, DropdownMenuItemState>()

  STATUS_FILTER_OPTIONS.forEach((opt) => {
    const item = document.createElement('div')
    item.className = `nk-menu-item nk-menu__item nk-menu-item_theme_islands nk-menu-item_size_m nk-select__option ${
      opt.id === initialFilter ? 'nk-menu-item_checked nk-menu__item_checked' : ''
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

  // Секция выбора периода истории правок
  const periodSection = document.createElement('div')
  periodSection.className = 'nmap-feeds-period-section'

  const periodHeader = document.createElement('div')
  periodHeader.className = 'nmap-feeds-period-header'
  periodHeader.textContent = 'Период истории'
  periodSection.appendChild(periodHeader)

  const periodButtonsContainer = document.createElement('div')
  periodButtonsContainer.className = 'nmap-feeds-period-buttons'

  const periodButtonsMap = new Map<number, HTMLButtonElement>()

  HISTORY_PERIOD_OPTIONS.forEach((days) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `nmap-feeds-period-btn ${
      days === initialDays ? 'nmap-feeds-period-btn_active' : ''
    }`
    btn.textContent = `${days} дн.`
    btn.setAttribute('aria-label', `Загрузить историю за ${days} дн.`)
    btn.setAttribute('aria-pressed', days === initialDays ? 'true' : 'false')

    btn.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onSelectPeriod?.(days)
    })

    periodButtonsMap.set(days, btn)
    periodButtonsContainer.appendChild(btn)
  })
  periodSection.appendChild(periodButtonsContainer)

  const statusRow = document.createElement('div')
  statusRow.className = 'nmap-feeds-period-status-row'

  const statusText = document.createElement('span')
  statusText.className = 'nmap-feeds-period-status-text'
  statusText.textContent = `Период: ${initialDays} дн.`
  statusRow.appendChild(statusText)

  const stopBtn = document.createElement('button')
  stopBtn.type = 'button'
  stopBtn.className = 'nmap-feeds-period-stop-btn'
  stopBtn.textContent = 'Остановить'
  stopBtn.style.display = 'none'
  stopBtn.setAttribute('aria-label', 'Остановить загрузку истории')

  stopBtn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onStopLoading?.()
  })
  statusRow.appendChild(stopBtn)

  periodSection.appendChild(statusRow)
  popupContent.appendChild(periodSection)

  const updatePeriodDisplay = (state: DropdownPeriodDisplayState): void => {
    periodButtonsMap.forEach((btn, days) => {
      const isActive = days === state.activeDays
      btn.classList.toggle('nmap-feeds-period-btn_active', isActive)
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
    })

    if (state.isLoading) {
      const targetDays = state.targetDays ?? state.activeDays
      statusText.textContent = `Загрузка (${targetDays} дн.): ${state.loadedCardsCount} шт.`
      stopBtn.style.display = 'inline-block'
    } else {
      statusText.textContent = `Загружено за ${state.activeDays} дн. (${state.loadedCardsCount} шт.)`
      stopBtn.style.display = 'none'
    }
  }

  return { popupElement: popup, menuElement: menu, itemMap, updatePeriodDisplay }
}
