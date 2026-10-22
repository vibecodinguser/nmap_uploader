import { parseStaticSvg } from '@/lib/parse_static_svg'
import { FEEDS_FILTER_POPUP_ID, STATUS_FILTER_OPTIONS } from './constants'
import type { FeedStatusId } from './core'

export interface DropdownMenuItemState {
  itemElement: HTMLElement
  countBadge: HTMLSpanElement
}

export interface DropdownMenuComponent {
  popupElement: HTMLElement
  menuElement: HTMLElement
  itemMap: Map<FeedStatusId, DropdownMenuItemState>
}

export const createDropdownMenu = (
  initialFilter: FeedStatusId,
  onSelect: (status: FeedStatusId) => void,
): DropdownMenuComponent => {
  const popup = document.createElement('div')
  popup.id = FEEDS_FILTER_POPUP_ID
  popup.className = 'nk-popup nk-popup_theme_islands nmap-feeds-status-popup'
  popup.style.display = 'none'

  const menu = document.createElement('div')
  menu.className = 'nk-menu nk-menu_theme_islands nk-menu_size_m nk-menu_mode_radio'
  menu.setAttribute('role', 'listbox')
  popup.appendChild(menu)

  const itemMap = new Map<FeedStatusId, DropdownMenuItemState>()

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
        onSelect(opt.id)
      },
      true,
    )

    itemMap.set(opt.id, { itemElement: item, countBadge: badge })
    menu.appendChild(item)
  })

  return { popupElement: popup, menuElement: menu, itemMap }
}
