/**
 * DOM-компоненты выпадающего меню сервисов "Перейти на...".
 */

import type { GoToItem } from '@/lib/go_to_settings'
import { getGoToSourceDisplayName } from '@/lib/go_to_sources'
import { applyGoToTheme } from '@/lib/go_to_theme'
import type { Locale } from '@/lib/i18n/locale.types'

export const MENU_ID = 'goToLinksMenu'
export const MENU_ITEMS_ID = 'linksItems'

export const createGoToMenuElement = (): HTMLElement => {
  const menu = document.createElement('div')
  menu.id = MENU_ID
  menu.className = 'nmap-uploader-popup'

  const content = document.createElement('div')
  content.className = 'nmap-uploader-popup__content'

  const menuItems = document.createElement('div')
  menuItems.id = MENU_ITEMS_ID
  menuItems.className = 'nmap-uploader-menu'
  menuItems.tabIndex = 0
  menuItems.setAttribute('role', 'menu')

  content.appendChild(menuItems)
  menu.appendChild(content)
  applyGoToTheme(menu)
  return menu
}

export const createMenuItemElement = (
  item: GoToItem,
  iconUrl: string,
  locale: Locale,
): HTMLDivElement => {
  const menuItem = document.createElement('div')
  menuItem.id = `goToLink${item.name}`
  menuItem.className = 'nmap-uploader-menu__item'
  menuItem.setAttribute('role', 'menuitem')
  menuItem.style.backgroundImage = `url("${iconUrl}")`
  menuItem.textContent = getGoToSourceDisplayName(item.name, locale)
  return menuItem
}

export const getGoToSourceNameFromMenuItemId = (menuItemId: string): string => {
  return menuItemId.replace('goToLink', '')
}

export const isGoToMenuItemTarget = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && target.id.startsWith('goToLink')
