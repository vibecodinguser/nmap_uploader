/**
 * Управление всплывающим меню ссылок "Перейти на..." и переход по координатам.
 */

import {
  createMenuItemElement,
  getGoToSourceNameFromMenuItemId,
  isGoToMenuItemTarget,
  MENU_ID,
  MENU_ITEMS_ID,
} from '@/lib/go_to/menu_dom'
import { getServiceButton } from '@/lib/go_to/toolbar_mount'
import { hideGoToTooltip } from '@/lib/go_to_dom'
import { buildGoToLink, getMapLocationFromUrl } from '@/lib/go_to_link'
import { type GoToItem, getActiveGoToItems, getStoredGoToItems } from '@/lib/go_to_settings'
import { GO_TO_SOURCES, getGoToSourceIconUrl } from '@/lib/go_to_sources'
import { GO_TO_MENU_ITEM_HOVERED_CLASS, GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'
import { refreshGoToThemeFromStorage, syncGoToTheme } from '@/lib/go_to_theme'
import type { Locale } from '@/lib/i18n/locale.types'

export const getMenu = (): HTMLElement | null => document.getElementById(MENU_ID)
export const getMenuItems = (): HTMLElement | null => document.getElementById(MENU_ITEMS_ID)

export const openGoToLink = (
  sourceName: string,
  keepFocus: boolean,
  onAfterOpen?: () => void,
): void => {
  const source = GO_TO_SOURCES[sourceName]
  const mapLocation = getMapLocationFromUrl(window.location.href)
  if (source && mapLocation) {
    const link = buildGoToLink(source, mapLocation)
    if (link) {
      window.open(link, '_blank')
      if (keepFocus) {
        window.focus()
      } else {
        onAfterOpen?.()
      }
    }
  }
}

export const renderMenuItems = (
  items: GoToItem[],
  locale: Locale,
  onOpenLink: (sourceName: string, keepFocus: boolean) => void,
): void => {
  const menuItems = getMenuItems()
  if (!menuItems) return

  menuItems.replaceChildren()

  for (const item of getActiveGoToItems(items)) {
    const iconUrl = getGoToSourceIconUrl(item.name)
    const menuItem = createMenuItemElement(item, iconUrl, locale)

    menuItem.addEventListener('mouseover', (e: MouseEvent) => {
      const target = e.currentTarget
      if (isGoToMenuItemTarget(target)) {
        target.classList.add(GO_TO_MENU_ITEM_HOVERED_CLASS)
      }
    })

    menuItem.addEventListener('mouseout', (e: MouseEvent) => {
      const target = e.currentTarget
      if (isGoToMenuItemTarget(target)) {
        target.classList.remove(GO_TO_MENU_ITEM_HOVERED_CLASS)
      }
    })

    menuItem.addEventListener('click', (e: MouseEvent) => {
      const target = e.currentTarget
      if (isGoToMenuItemTarget(target)) {
        onOpenLink(getGoToSourceNameFromMenuItemId(target.id), false)
      }
    })

    menuItem.addEventListener('auxclick', (e: MouseEvent) => {
      if (e.button === 1) {
        const target = e.currentTarget
        if (isGoToMenuItemTarget(target)) {
          e.preventDefault()
          onOpenLink(getGoToSourceNameFromMenuItemId(target.id), true)
        }
      }
    })

    menuItems.appendChild(menuItem)
  }
}

export const hideGoToMenu = (): void => {
  document.documentElement.removeEventListener('click', hideGoToMenu, true)
  getMenu()?.classList.remove(GO_TO_POPUP_VISIBLE_CLASS)
  hideGoToTooltip()
}

export const showGoToMenu = (): void => {
  const menu = getMenu()
  const button = getServiceButton()
  if (!menu || !button) return

  if (menu.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)) {
    hideGoToMenu()
    return
  }

  void refreshGoToThemeFromStorage().then(() => {
    syncGoToTheme()
    menu.classList.add(GO_TO_POPUP_VISIBLE_CLASS)
    const documentRoot = document.documentElement
    menu.style.bottom = `${documentRoot.clientHeight - button.getBoundingClientRect().top + 10}px`
    menu.style.left = `${button.getBoundingClientRect().left}px`
    documentRoot.addEventListener('click', hideGoToMenu, true)
    hideGoToTooltip()
  })
}

export const refreshGoToMenuItems = async (locale: Locale): Promise<void> => {
  const items = await getStoredGoToItems()
  renderMenuItems(items, locale, (sourceName, keepFocus) => {
    openGoToLink(sourceName, keepFocus, hideGoToMenu)
  })
}
