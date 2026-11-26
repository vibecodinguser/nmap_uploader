/**
 * Управление всплывающим меню ссылок "Перейти на..." и переход по координатам.
 */

import {
  consumeDragMoved,
  DRAG_ACTIVE_ATTRIBUTE,
  type DragSortRow,
  moveRowToRow,
  resetDragMoved,
  restoreRowOrder,
  startDragSort,
} from '@/lib/go_to/drag_sort'
import {
  createMenuItemElement,
  GO_TO_MENU_ITEM_ID_PREFIX,
  getGoToSourceNameFromMenuItemId,
  isGoToMenuGripTarget,
  isGoToMenuItemTarget,
  MENU_ID,
  MENU_ITEMS_ID,
} from '@/lib/go_to/menu_dom'
import { getOwnedElementById } from '@/lib/go_to/ownership'
import { getServiceButton } from '@/lib/go_to/toolbar_mount'
import { hideGoToTooltip } from '@/lib/go_to_dom'
import { buildGoToLink, getMapLocationFromUrl } from '@/lib/go_to_link'
import {
  applyGoToVisibleOrder,
  type GoToItem,
  getActiveGoToItems,
  getStoredGoToItems,
  setStoredGoToItems,
} from '@/lib/go_to_settings'
import { GO_TO_SOURCES, getGoToSourceIconUrl } from '@/lib/go_to_sources'
import { GO_TO_MENU_ITEM_HOVERED_CLASS, GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'
import { syncGoToTheme } from '@/lib/go_to_theme'
import type { Locale } from '@/lib/i18n/locale.types'

const getMenu = (): HTMLElement | null => getOwnedElementById(MENU_ID)
const getMenuItems = (): HTMLElement | null => getOwnedElementById(MENU_ITEMS_ID)

const getMenuRows = (): DragSortRow[] => {
  const menuItems = getMenuItems()
  if (!menuItems) return []

  const rows: DragSortRow[] = []
  for (const child of Array.from(menuItems.children)) {
    if (!(child instanceof HTMLElement)) continue
    rows.push({ key: getGoToSourceNameFromMenuItemId(child.id), element: child })
  }
  return rows
}

const setMenuRowDragging = (name: string | null): void => {
  for (const row of getMenuRows()) {
    if (row.key === name) {
      row.element.setAttribute(DRAG_ACTIVE_ATTRIBUTE, 'true')
    } else {
      row.element.removeAttribute(DRAG_ACTIVE_ATTRIBUTE)
    }
  }
}

const persistMenuOrder = async (): Promise<void> => {
  const visibleNames = getMenuRows().map((row) => row.key)
  const stored = await getStoredGoToItems()
  const next = applyGoToVisibleOrder(stored, visibleNames)
  if (next === stored) return
  await setStoredGoToItems(next)
}

function onPersistMenuOrderError(error: unknown): void {
  console.warn('[yamapper] go-to menu order save failed:', error)
}

const persistMenuOrderSafely = (): void => {
  persistMenuOrder().catch(onPersistMenuOrderError)
}

const handleMenuItemPointerDown = (event: PointerEvent): void => {
  const target = event.target
  if (!(target instanceof Element)) return

  // Тянем только за ручку: остальная площадь строки — клик для перехода.
  if (!isGoToMenuGripTarget(target)) return

  const menuItem = target.closest(`[id^="${GO_TO_MENU_ITEM_ID_PREFIX}"]`)
  const menuItems = getMenuItems()
  if (!(menuItem instanceof HTMLElement) || !menuItems?.contains(menuItem)) return

  // Клик по пункту после перетаскивания открывать ссылку не должен.
  resetDragMoved()

  const initialKeys = getMenuRows().map((row) => row.key)
  const name = getGoToSourceNameFromMenuItemId(menuItem.id)

  startDragSort({
    event,
    key: name,
    getRows: getMenuRows,
    onMoveStart: setMenuRowDragging,
    onReorder: (movedKey, targetKey) => {
      const container = getMenuItems()
      if (container) moveRowToRow(getMenuRows(), container, movedKey, targetKey)
    },
    onRestore: () => {
      const container = getMenuItems()
      if (container) restoreRowOrder(getMenuRows(), container, initialKeys)
    },
    onMoveEnd: (_movedKey, moved) => {
      setMenuRowDragging(null)
      if (moved) persistMenuOrderSafely()
    },
    onCancel: () => setMenuRowDragging(null),
  })
}

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

  // Перетаскивание слушает контейнер, а не отдельные пункты: пункты
  // пересоздаются при каждой перерисовке меню, а контейнер живёт до удаления.
  if (menuItems.dataset.nmapGoToDragBound !== 'true') {
    menuItems.dataset.nmapGoToDragBound = 'true'
    menuItems.addEventListener('pointerdown', handleMenuItemPointerDown)
  }

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
        if (consumeDragMoved()) return
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

const positionMenu = (): void => {
  const menu = getMenu()
  const button = getServiceButton()
  if (!menu || !button) return

  const documentRoot = document.documentElement
  const buttonRect = button.getBoundingClientRect()
  menu.style.bottom = `${documentRoot.clientHeight - buttonRect.top + 10}px`
  menu.style.left = `${Math.max(buttonRect.left, 12)}px`
}

const handleDocumentPointerDown = (event: PointerEvent): void => {
  const target = event.target
  if (!(target instanceof Node)) return
  const menu = getMenu()
  const button = getServiceButton()
  if (menu?.contains(target) || button?.contains(target)) return
  hideGoToMenu()
}

const handleDocumentKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    hideGoToMenu()
  }
}

export const hideGoToMenu = (): void => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('keydown', handleDocumentKeyDown)
  window.removeEventListener('resize', positionMenu)

  const menu = getMenu()
  if (menu) {
    menu.classList.remove(GO_TO_POPUP_VISIBLE_CLASS)
  }
  const button = getServiceButton()
  if (button) {
    button.setAttribute('aria-expanded', 'false')
  }
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

  syncGoToTheme()
  menu.classList.add(GO_TO_POPUP_VISIBLE_CLASS)
  button.setAttribute('aria-expanded', 'true')
  positionMenu()

  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleDocumentKeyDown)
  window.addEventListener('resize', positionMenu)

  hideGoToTooltip()
}
