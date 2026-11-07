// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import mapGoToScript from '@/entrypoints/map-go-to.content'
import { GO_TO_MENU_ITEM_ID_PREFIX, MENU_ID, MENU_ITEMS_ID } from '@/lib/go_to/menu_dom'
import { resolveAnchor } from '@/lib/go_to/toolbar_mount'
import { GO_TO_SERVICE_BUTTON_ID } from '@/lib/go_to_service_button'
import { GO_TO_ITEMS_STORAGE_KEY, GO_TO_MENU_ENABLED_STORAGE_KEY } from '@/lib/go_to_settings'
import { GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const FOREIGN_BUTTON_ID = 'goToButton'
const FOREIGN_MENU_ID = 'goToLinksMenu'
const FOREIGN_ITEMS_ID = 'linksItems'

type ForeignFixture = {
  nativeAnchor: HTMLElement
  foreignButton: HTMLAnchorElement
  foreignMenu: HTMLElement
  foreignItems: HTMLElement
}

/**
 * Повторяет разметку расширения «Расширение Народной карты» v17.10.0:
 * кнопка #goToButton, меню #goToLinksMenu, контейнер #linksItems,
 * иконка кнопки содержит .nk-icon_id_ymaps (совпадает с нашим якорем).
 */
const mountForeignExtensionFixture = (): ForeignFixture => {
  const nativeContainer = document.createElement('div')

  const nativeButton = document.createElement('a')
  nativeButton.className = 'nk-map-region-view__button nk-map-region-view__button_id_ymaps'
  const nativeIcon = document.createElement('span')
  nativeIcon.className = 'nk-icon nk-icon_id_ymaps'
  nativeButton.appendChild(nativeIcon)
  nativeContainer.appendChild(nativeButton)

  const foreignButton = document.createElement('a')
  foreignButton.id = FOREIGN_BUTTON_ID
  foreignButton.className = 'nk-map-region-view__button nk-map-region-view__button_id_goto'
  const foreignIcon = document.createElement('span')
  foreignIcon.className = 'nk-icon nk-icon_id_ymaps'
  foreignButton.appendChild(foreignIcon)
  nativeButton.insertAdjacentElement('afterend', foreignButton)

  const wrapper = document.createElement('div')
  const foreignMenu = document.createElement('div')
  foreignMenu.id = FOREIGN_MENU_ID
  foreignMenu.className = 'nk-popup nk-popup_theme_islands'

  const foreignContent = document.createElement('div')
  foreignContent.className = 'nk-popup__content'
  const foreignItems = document.createElement('div')
  foreignItems.id = FOREIGN_ITEMS_ID

  const foreignItem = document.createElement('div')
  // Чужое расширение использует старый префикс id пунктов.
  foreignItem.id = 'goToLinkNakarte'
  foreignItem.textContent = 'чужой пункт'
  foreignItems.appendChild(foreignItem)

  foreignContent.appendChild(foreignItems)
  foreignMenu.appendChild(foreignContent)
  wrapper.appendChild(foreignMenu)

  document.body.appendChild(nativeContainer)
  document.body.appendChild(wrapper)

  foreignButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    foreignMenu.classList.add('nk-popup_visible')
  })

  return { nativeAnchor: nativeIcon, foreignButton, foreignMenu, foreignItems }
}

describe('map-go-to.content рядом с чужим расширением', () => {
  let ctx: ReturnType<typeof createContentScriptContext>

  beforeEach(async () => {
    ctx = createContentScriptContext()
    await browser.storage.local.set({
      [GO_TO_MENU_ENABLED_STORAGE_KEY]: true,
      [GO_TO_ITEMS_STORAGE_KEY]: [{ name: 'Nakarte', active: true }],
    })
  })

  afterEach(() => {
    ctx.runInvalidated()
    document.body.replaceChildren()
    document.querySelectorAll(`[id="${MENU_ID}"]`).forEach((element) => {
      element.remove()
    })
    document.head.replaceChildren()
    vi.restoreAllMocks()
  })

  it('монтируется рядом, не перехватывает чужое меню и открывает своё', async () => {
    const fixture = mountForeignExtensionFixture()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Якорь — нативная кнопка карты, а не иконка чужой go-to кнопки.
    expect(resolveAnchor()).toBe(fixture.nativeAnchor)

    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull()
    })

    const serviceButton = document.getElementById(GO_TO_SERVICE_BUTTON_ID)
    const ourMenu = document.getElementById(MENU_ID)
    const ourItems = document.getElementById(MENU_ITEMS_ID)

    expect(serviceButton).not.toBe(fixture.foreignButton)
    expect(ourMenu).not.toBeNull()
    expect(ourMenu).not.toBe(fixture.foreignMenu)
    expect(ourItems).not.toBe(fixture.foreignItems)

    // Чужое меню и его пункты остались нетронутыми.
    expect(fixture.foreignMenu.id).toBe(FOREIGN_MENU_ID)
    expect(fixture.foreignItems.children).toHaveLength(1)
    expect(fixture.foreignItems.textContent).toBe('чужой пункт')

    serviceButton?.click()

    await vi.waitFor(() => {
      expect(ourMenu?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(true)
    })
    // Чужое меню не получило наш класс видимости.
    expect(fixture.foreignMenu.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(false)
    expect(fixture.foreignMenu.classList.contains('nk-popup_visible')).toBe(false)

    // Наши пункты отрисованы в наш контейнер.
    expect(ourItems?.children.length).toBeGreaterThan(0)
    expect(document.getElementById(`${GO_TO_MENU_ITEM_ID_PREFIX}Nakarte`)).not.toBeNull()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('похожей функцией'))
  })
})
