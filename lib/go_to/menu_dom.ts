/**
 * DOM-компоненты выпадающего меню сервисов "Перейти на...".
 */

import { markNmapOwned } from '@/lib/go_to/ownership'
import type { GoToItem } from '@/lib/go_to_settings'
import { getGoToSourceDisplayName } from '@/lib/go_to_sources'
import { applyGoToTheme } from '@/lib/go_to_theme'
import type { Locale } from '@/lib/i18n/locale.types'
import { parseStaticSvg } from '@/lib/parse_static_svg'

export const MENU_ID = 'nmapUploaderGoToLinksMenu'
export const MENU_ITEMS_ID = 'nmapUploaderGoToLinksItems'
export const GO_TO_MENU_ITEM_ID_PREFIX = 'nmapUploaderGoToLink'

/** Ручка перетаскивания пункта: за неё строку тянут мышью. */
export const GO_TO_MENU_ITEM_GRIP_CLASS = 'yamapper-menu__grip'

const GO_TO_MENU_ITEM_ICON_CLASS = 'yamapper-menu__icon'
const GO_TO_MENU_ITEM_LABEL_CLASS = 'yamapper-menu__label'

/** Точки-грип в стиле `grip-vertical`: нарисован, чтобы не тянуть иконку шрифта. */
const GO_TO_MENU_ITEM_GRIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>`

export const createGoToMenuElement = (): HTMLElement => {
  const menu = document.createElement('div')
  menu.id = MENU_ID
  menu.className = 'yamapper-popup'

  const content = document.createElement('div')
  content.className = 'yamapper-popup__content'

  const menuItems = document.createElement('div')
  menuItems.id = MENU_ITEMS_ID
  menuItems.className = 'yamapper-menu'
  menuItems.tabIndex = 0
  menuItems.setAttribute('role', 'menu')

  content.appendChild(menuItems)
  menu.appendChild(content)
  applyGoToTheme(menu)
  markNmapOwned(menuItems)
  return markNmapOwned(menu)
}

const createDragGripElement = (): HTMLSpanElement => {
  const grip = document.createElement('span')
  grip.className = GO_TO_MENU_ITEM_GRIP_CLASS
  grip.setAttribute('aria-hidden', 'true')
  grip.appendChild(parseStaticSvg(GO_TO_MENU_ITEM_GRIP_SVG))
  return grip
}

const createIconElement = (iconUrl: string): HTMLSpanElement => {
  const icon = document.createElement('span')
  icon.className = GO_TO_MENU_ITEM_ICON_CLASS
  icon.setAttribute('aria-hidden', 'true')
  icon.style.backgroundImage = `url("${iconUrl}")`
  return icon
}

export const createMenuItemElement = (
  item: GoToItem,
  iconUrl: string,
  locale: Locale,
): HTMLDivElement => {
  const menuItem = document.createElement('div')
  menuItem.id = `${GO_TO_MENU_ITEM_ID_PREFIX}${item.name}`
  menuItem.className = 'yamapper-menu__item'
  menuItem.setAttribute('role', 'menuitem')

  const label = document.createElement('span')
  label.className = GO_TO_MENU_ITEM_LABEL_CLASS
  label.textContent = getGoToSourceDisplayName(item.name, locale)

  menuItem.append(createDragGripElement(), createIconElement(iconUrl), label)
  return markNmapOwned(menuItem)
}

export const getGoToSourceNameFromMenuItemId = (menuItemId: string): string => {
  return menuItemId.replace(GO_TO_MENU_ITEM_ID_PREFIX, '')
}

export const isGoToMenuItemTarget = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && target.id.startsWith(GO_TO_MENU_ITEM_ID_PREFIX)

export const isGoToMenuGripTarget = (target: EventTarget | null): target is HTMLElement =>
  target instanceof Element && target.closest(`.${GO_TO_MENU_ITEM_GRIP_CLASS}`) !== null
