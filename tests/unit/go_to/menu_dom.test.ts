// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createGoToMenuElement,
  createMenuItemElement,
  GO_TO_MENU_ITEM_ID_PREFIX,
  getGoToSourceNameFromMenuItemId,
  isGoToMenuItemTarget,
  MENU_ID,
  MENU_ITEMS_ID,
} from '@/lib/go_to/menu_dom'
import { isNmapOwned } from '@/lib/go_to/ownership'

describe('go_to/menu_dom', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('createGoToMenuElement создает попап меню с нужными id и классами', () => {
    const el = createGoToMenuElement()
    expect(el.id).toBe(MENU_ID)
    expect(el.id).not.toBe('goToLinksMenu')
    expect(el.querySelector(`#${MENU_ITEMS_ID}`)).not.toBeNull()
    expect(isNmapOwned(el)).toBe(true)
  })

  it('createMenuItemElement создает пункт меню с иконкой и локализованным названием', () => {
    const item = { name: 'OpenStreetMap', active: true }
    const el = createMenuItemElement(item, 'data:image/svg+xml;utf8,<svg></svg>', 'ru')
    expect(el.id).toBe(`${GO_TO_MENU_ITEM_ID_PREFIX}OpenStreetMap`)
    expect(el.textContent).toBe('OpenStreetMap')
    expect(el.style.backgroundImage).toContain('data:image/svg+xml')
  })

  it('getGoToSourceNameFromMenuItemId извлекает имя источника из ID', () => {
    expect(getGoToSourceNameFromMenuItemId(`${GO_TO_MENU_ITEM_ID_PREFIX}google`)).toBe('google')
    expect(getGoToSourceNameFromMenuItemId(`${GO_TO_MENU_ITEM_ID_PREFIX}nakarte`)).toBe('nakarte')
  })

  it('isGoToMenuItemTarget определяет клик по пункту меню', () => {
    const el = document.createElement('div')
    el.id = `${GO_TO_MENU_ITEM_ID_PREFIX}osm`
    expect(isGoToMenuItemTarget(el)).toBe(true)

    const other = document.createElement('div')
    other.id = 'other'
    expect(isGoToMenuItemTarget(other)).toBe(false)
  })
})
