// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetDragMoved } from '@/lib/go_to/drag_sort'
import { renderMenuItems } from '@/lib/go_to/menu_controller'
import {
  createGoToMenuElement,
  GO_TO_MENU_ITEM_GRIP_CLASS,
  GO_TO_MENU_ITEM_ID_PREFIX,
  MENU_ITEMS_ID,
} from '@/lib/go_to/menu_dom'
import type { GoToItem } from '@/lib/go_to_settings'

const ROW_HEIGHT = 40

const ITEMS: GoToItem[] = [
  { name: 'Google', active: true },
  { name: 'Bing', active: true },
  { name: 'Nakarte', active: false },
  { name: 'Etomesto', active: true },
]

const pointer = (type: string, init: PointerEventInit = {}): PointerEvent =>
  new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })

const mountMenu = (): HTMLElement => {
  document.body.appendChild(createGoToMenuElement())
  const menuItems = document.getElementById(MENU_ITEMS_ID)
  if (!menuItems) throw new Error('контейнер пунктов меню не создан')
  return menuItems
}

const stubRowRects = (menuItems: HTMLElement): void => {
  Array.from(menuItems.children).forEach((child, index) => {
    const element = child as HTMLElement
    element.getBoundingClientRect = () =>
      ({
        top: index * ROW_HEIGHT,
        bottom: index * ROW_HEIGHT + ROW_HEIGHT,
        height: ROW_HEIGHT,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: index * ROW_HEIGHT,
        toJSON: () => ({}),
      }) as DOMRect
  })
}

const itemNames = (menuItems: HTMLElement): string[] =>
  Array.from(menuItems.children).map((child) =>
    (child as HTMLElement).id.replace(GO_TO_MENU_ITEM_ID_PREFIX, ''),
  )

const gripOf = (menuItem: HTMLElement): HTMLElement => {
  const grip = menuItem.querySelector<HTMLElement>(`.${GO_TO_MENU_ITEM_GRIP_CLASS}`)
  if (!grip) throw new Error('у пункта меню нет ручки перетаскивания')
  return grip
}

const dragFirstRowDown = (menuItems: HTMLElement, toY: number): void => {
  const first = menuItems.children[0] as HTMLElement
  gripOf(first).dispatchEvent(pointer('pointerdown', { clientY: 10, clientX: 5 }))
  document.dispatchEvent(pointer('pointermove', { clientY: toY, clientX: 5 }))
  document.dispatchEvent(pointer('pointerup', { clientY: toY, clientX: 5 }))
}

describe('перетаскивание пунктов меню геосервисов', () => {
  afterEach(() => {
    document.body.replaceChildren()
    resetDragMoved()
  })

  it('показывает только активные пункты и переставляет их за ручку', () => {
    const menuItems = mountMenu()
    renderMenuItems(ITEMS, 'ru', () => {})

    expect(itemNames(menuItems)).toEqual(['Google', 'Bing', 'Etomesto'])
    stubRowRects(menuItems)

    dragFirstRowDown(menuItems, 100)

    expect(itemNames(menuItems)).toEqual(['Bing', 'Etomesto', 'Google'])
  })

  it('не переставляет строку, если тянуть не за ручку', () => {
    const menuItems = mountMenu()
    renderMenuItems(ITEMS, 'ru', () => {})
    stubRowRects(menuItems)

    const first = menuItems.children[0] as HTMLElement
    const label = first.querySelector<HTMLElement>('.yamapper-menu__label')
    label?.dispatchEvent(pointer('pointerdown', { clientY: 10, clientX: 5 }))
    document.dispatchEvent(pointer('pointermove', { clientY: 100, clientX: 5 }))
    document.dispatchEvent(pointer('pointerup', { clientY: 100, clientX: 5 }))

    expect(itemNames(menuItems)).toEqual(['Google', 'Bing', 'Etomesto'])
  })

  it('помечает перетаскиваемую строку, пока указатель её держит', () => {
    const menuItems = mountMenu()
    renderMenuItems(ITEMS, 'ru', () => {})
    stubRowRects(menuItems)

    const first = menuItems.children[0] as HTMLElement
    gripOf(first).dispatchEvent(pointer('pointerdown', { clientY: 10, clientX: 5 }))
    document.dispatchEvent(pointer('pointermove', { clientY: 60, clientX: 5 }))

    const draggingRows = menuItems.querySelectorAll('[data-dragging="true"]')
    expect(draggingRows).toHaveLength(1)
    expect((draggingRows[0] as HTMLElement).id).toBe(`${GO_TO_MENU_ITEM_ID_PREFIX}Google`)

    document.dispatchEvent(pointer('pointerup', { clientY: 60, clientX: 5 }))
    expect(menuItems.querySelectorAll('[data-dragging="true"]')).toHaveLength(0)
  })

  it('не открывает ссылку кликом, которым закончилось перетаскивание', () => {
    const menuItems = mountMenu()
    const onOpenLink = vi.fn()
    renderMenuItems(ITEMS, 'ru', onOpenLink)
    stubRowRects(menuItems)

    dragFirstRowDown(menuItems, 100)

    const dragged = menuItems.children[2] as HTMLElement
    expect(dragged.id).toBe(`${GO_TO_MENU_ITEM_ID_PREFIX}Google`)

    dragged.click()
    expect(onOpenLink).not.toHaveBeenCalled()

    dragged.click()
    expect(onOpenLink).toHaveBeenCalledWith('Google', false)
  })

  it('обычный клик без движения открывает ссылку', () => {
    const menuItems = mountMenu()
    const onOpenLink = vi.fn()
    renderMenuItems(ITEMS, 'ru', onOpenLink)
    stubRowRects(menuItems)

    const first = menuItems.children[0] as HTMLElement
    gripOf(first).dispatchEvent(pointer('pointerdown', { clientY: 10, clientX: 5 }))
    document.dispatchEvent(pointer('pointerup', { clientY: 10, clientX: 5 }))
    first.click()

    expect(onOpenLink).toHaveBeenCalledWith('Google', false)
  })
})
