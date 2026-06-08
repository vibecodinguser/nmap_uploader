import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { buildGoToButtonHtml, GO_TO_BUTTON_HIDDEN_CLASS, GO_TO_BUTTON_ID } from '@/lib/go_to_button'
import {
  hideGoToTooltip,
  isElementDescendantToOrEquals,
  runWhenAnyElementExists,
  showGoToTooltip,
} from '@/lib/go_to_dom'
import { buildGoToLink, getMapLocationFromUrl } from '@/lib/go_to_link'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import {
  GO_TO_ITEMS_STORAGE_KEY,
  GO_TO_MENU_ENABLED_STORAGE_KEY,
  type GoToItem,
  getActiveGoToItems,
  getStoredGoToItems,
  getStoredGoToMenuEnabled,
} from '@/lib/go_to_settings'
import { GO_TO_SOURCES, getGoToSourceDisplayName, getGoToSourceIconUrl } from '@/lib/go_to_sources'
import {
  buildSplitViewButtonHtml,
  GO_TO_SPLIT_BUTTON_HIDDEN_CLASS,
  GO_TO_SPLIT_BUTTON_ID,
} from '@/lib/go_to_split_button'
import { isSplitViewOpen, teardownSplitView, toggleSplitView } from '@/lib/go_to_split_view'
import {
  ensureGoToStyles,
  GO_TO_BUTTON_HOVERED_CLASS,
  GO_TO_MENU_ITEM_HOVERED_CLASS,
  GO_TO_POPUP_VISIBLE_CLASS,
} from '@/lib/go_to_styles'

const BUTTON_ANCHOR_SELECTORS = [
  '.nk-map-region-view__button .nk-icon_id_ymaps',
  '.nk-map-region-view__button_id_ymaps',
  '.nk-icon_id_ymaps',
] as const

const BUTTON_ID = GO_TO_BUTTON_ID
const SPLIT_BUTTON_ID = GO_TO_SPLIT_BUTTON_ID
const MENU_ID = 'goToLinksMenu'
const MENU_ITEMS_ID = 'linksItems'

const REGION_BUTTON_CLASSES = [
  'nk-map-region-view__button',
  'nk-map-region-view__button_id_goto',
] as const

const MENU_HTML = `<div id="${MENU_ID}" class="nmap-uploader-popup"><div class="nmap-uploader-popup__content"><div id="${MENU_ITEMS_ID}" class="nmap-uploader-menu" tabindex="0" role="menu"></div></div></div>`

const MENU_ITEM_HTML = `<div id="goToLink{index}" class="nmap-uploader-menu__item" role="menuitem" style="background-image: url({iconUrl});"></div>`

const getButton = (): HTMLElement | null => document.getElementById(BUTTON_ID)
const getSplitButton = (): HTMLButtonElement | null =>
  document.getElementById(SPLIT_BUTTON_ID) as HTMLButtonElement | null
const getMenu = (): HTMLElement | null => document.getElementById(MENU_ID)
const getMenuItems = (): HTMLElement | null => document.getElementById(MENU_ITEMS_ID)

let waitForAnchorCleanup: (() => void) | undefined
let refreshPromise: Promise<void> | undefined

const resolveAnchor = (): Element | null => {
  for (const selector of BUTTON_ANCHOR_SELECTORS) {
    const anchor = document.querySelector(selector)
    if (anchor instanceof Element) return anchor
  }
  return null
}

const getButtonInsertParent = (anchor: Element): HTMLElement | null => {
  const parent = anchor.parentElement
  return parent instanceof HTMLElement ? parent : null
}

const removeMenu = (): void => {
  getMenu()?.remove()
}

const hideGoToButton = (): void => {
  const button = getButton()
  if (!button) return

  button.classList.add(GO_TO_BUTTON_HIDDEN_CLASS)
  button.setAttribute('aria-hidden', 'true')
  for (const className of REGION_BUTTON_CLASSES) {
    button.classList.remove(className)
  }
}

const showGoToButton = (): void => {
  const button = getButton()
  if (!button) return

  button.classList.remove(GO_TO_BUTTON_HIDDEN_CLASS)
  button.removeAttribute('aria-hidden')
  for (const className of REGION_BUTTON_CLASSES) {
    button.classList.add(className)
  }
}

const hideSplitButton = (): void => {
  const splitButton = getSplitButton()
  if (!splitButton) return

  splitButton.classList.add(GO_TO_SPLIT_BUTTON_HIDDEN_CLASS)
  splitButton.setAttribute('aria-hidden', 'true')
  for (const className of REGION_BUTTON_CLASSES) {
    splitButton.classList.remove(className)
  }
}

const showSplitButton = (): void => {
  const splitButton = getSplitButton()
  if (!splitButton) return

  splitButton.classList.remove(GO_TO_SPLIT_BUTTON_HIDDEN_CLASS)
  splitButton.removeAttribute('aria-hidden')
  for (const className of REGION_BUTTON_CLASSES) {
    splitButton.classList.add(className)
  }
}

const removeSplitButton = (): void => {
  teardownSplitView()
  getSplitButton()?.remove()
}

const removeButtonAndMenu = (): void => {
  waitForAnchorCleanup?.()
  waitForAnchorCleanup = undefined
  hideGoToTooltip()
  removeMenu()
  removeSplitButton()
  getButton()?.remove()
}

const hideButtonAndMenu = (): void => {
  waitForAnchorCleanup?.()
  waitForAnchorCleanup = undefined
  hideGoToTooltip()
  hideMenu()
  if (isSplitViewOpen()) teardownSplitView()
  hideGoToButton()
  hideSplitButton()
}

const renderMenuItems = (items: GoToItem[]): void => {
  const menuItems = getMenuItems()
  if (!menuItems) return

  menuItems.replaceChildren()

  for (const item of getActiveGoToItems(items)) {
    const iconUrl = getGoToSourceIconUrl(item.name)
    const menuItemHtml = MENU_ITEM_HTML.replace('{index}', item.name).replace('{iconUrl}', iconUrl)
    menuItems.insertAdjacentHTML('beforeend', menuItemHtml)

    const menuItem = document.getElementById(`goToLink${item.name}`)
    if (!menuItem) continue

    menuItem.textContent = getGoToSourceDisplayName(item.name)
    menuItem.addEventListener('mouseover', handleMenuItemMouseOver)
    menuItem.addEventListener('mouseout', handleMenuItemMouseOut)
    menuItem.addEventListener('click', handleMenuItemClick)
    menuItem.addEventListener('auxclick', handleMenuItemAuxClick)
  }
}

const ensureMenu = (): void => {
  if (getMenu()) return
  document.body.insertAdjacentHTML('beforeend', MENU_HTML)
}

const buildMenu = async (): Promise<void> => {
  ensureMenu()
  const items = await getStoredGoToItems()
  renderMenuItems(items)
}

const isButtonMountedInToolbar = (button: HTMLElement, anchor: Element): boolean => {
  const goToButton = getButton()
  if (!goToButton) return false

  let expectedPrevious: Element | null = getButtonInsertParent(anchor)
  if (button === goToButton) {
    return expectedPrevious?.nextElementSibling === button
  }

  const splitButton = getSplitButton()
  if (button === splitButton) {
    expectedPrevious = goToButton
    return expectedPrevious?.nextElementSibling === button
  }

  return false
}

const mountSplitButton = (): void => {
  const goToButton = getButton()
  if (!goToButton) return

  let splitButton = getSplitButton()
  if (splitButton && splitButton.previousElementSibling !== goToButton) {
    splitButton.remove()
    splitButton = null
  }

  if (!splitButton) {
    goToButton.insertAdjacentHTML('afterend', buildSplitViewButtonHtml())
    splitButton = getSplitButton()
    if (!splitButton) return

    splitButton.addEventListener('click', handleSplitButtonClick)
    splitButton.addEventListener('mouseover', handleSplitButtonMouseOver)
    splitButton.addEventListener('mouseout', handleSplitButtonMouseOut)
  }

  showSplitButton()
}

const mountButton = (anchor: Element): void => {
  const parent = getButtonInsertParent(anchor)
  if (!parent) return

  let button = getButton()

  if (button && !isButtonMountedInToolbar(button, anchor)) {
    button.remove()
    button = null
  }

  if (!button) {
    parent.insertAdjacentHTML('afterend', buildGoToButtonHtml())
    button = getButton()
    if (!button) return

    button.addEventListener('click', handleButtonClick)
    button.addEventListener('mouseover', handleButtonMouseOver)
    button.addEventListener('mouseout', handleButtonMouseOut)
  }

  showGoToButton()
  mountSplitButton()
  void buildMenu()
}

const hideMenu = (event?: Event): void => {
  if (event?.target && isElementDescendantToOrEquals(event.target, BUTTON_ID)) {
    event.stopPropagation()
  }

  document.body.removeEventListener('click', hideMenu, true)
  getMenu()?.classList.remove(GO_TO_POPUP_VISIBLE_CLASS)
  hideGoToTooltip()
}

const showMenu = (): void => {
  const menu = getMenu()
  const button = getButton()
  if (!menu || !button) return

  if (menu.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)) {
    hideMenu()
    return
  }

  menu.classList.add(GO_TO_POPUP_VISIBLE_CLASS)
  menu.style.bottom = `${document.body.clientHeight - button.getBoundingClientRect().top + 10}px`
  menu.style.left = `${button.getBoundingClientRect().left}px`
  document.body.addEventListener('click', hideMenu, true)
  hideGoToTooltip()
}

const openGoToLink = (sourceName: string, keepFocus: boolean): void => {
  const source = GO_TO_SOURCES[sourceName]
  const mapLocation = getMapLocationFromUrl(window.location.href)
  if (!source || !mapLocation) return

  const link = buildGoToLink(source, mapLocation)
  if (!link) return

  window.open(link, '_blank')
  if (keepFocus) window.focus()
  else hideMenu()
}

const handleMenuItemClick = (event: MouseEvent): void => {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || !target.id.startsWith('goToLink')) return
  openGoToLink(target.id.replace('goToLink', ''), false)
}

const handleMenuItemAuxClick = (event: MouseEvent): void => {
  if (event.button !== 1) return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || !target.id.startsWith('goToLink')) return
  event.preventDefault()
  openGoToLink(target.id.replace('goToLink', ''), true)
}

const handleButtonClick = (): void => {
  showMenu()
}

const handleSplitButtonClick = (event: MouseEvent): void => {
  event.preventDefault()
  event.stopPropagation()
  hideMenu()

  if (isSplitViewOpen()) {
    toggleSplitView()
    return
  }

  if (!getMapLocationFromUrl(window.location.href)) {
    const splitButton = getSplitButton()
    if (!splitButton) return
    showGoToTooltip('Не удалось определить положение карты из URL (ll, z)', splitButton, 'top')
    window.setTimeout(() => hideGoToTooltip(), 3000)
    return
  }

  if (!toggleSplitView()) {
    const splitButton = getSplitButton()
    if (!splitButton) return
    showGoToTooltip('Не удалось открыть сравнение с Nakarte', splitButton, 'top')
    window.setTimeout(() => hideGoToTooltip(), 3000)
  }
}

const handleSplitButtonMouseOver = (event: MouseEvent): void => {
  const splitButton = getSplitButton()
  if (!splitButton || !isElementDescendantToOrEquals(event.target, SPLIT_BUTTON_ID)) return
  splitButton.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
  showGoToTooltip('Раздельный вид', splitButton, 'top')
}

const handleSplitButtonMouseOut = (event: MouseEvent): void => {
  const splitButton = getSplitButton()
  if (!splitButton || !isElementDescendantToOrEquals(event.target, SPLIT_BUTTON_ID)) return
  splitButton.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
  hideGoToTooltip()
}

const handleButtonMouseOver = (event: MouseEvent): void => {
  const button = getButton()
  if (!button || !isElementDescendantToOrEquals(event.target, BUTTON_ID)) return
  button.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
  showGoToTooltip('Внешние геосервисы', button, 'top')
}

const handleButtonMouseOut = (event: MouseEvent): void => {
  const button = getButton()
  if (!button || !isElementDescendantToOrEquals(event.target, BUTTON_ID)) return
  button.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
  hideGoToTooltip()
}

const handleMenuItemMouseOver = (event: MouseEvent): void => {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || !target.id.startsWith('goToLink')) return

  target.classList.add(GO_TO_MENU_ITEM_HOVERED_CLASS)
}

const handleMenuItemMouseOut = (event: MouseEvent): void => {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || !target.id.startsWith('goToLink')) return
  target.classList.remove(GO_TO_MENU_ITEM_HOVERED_CLASS)
}

const refreshMenuItems = async (): Promise<void> => {
  const menuItems = getMenuItems()
  if (!menuItems) {
    await buildMenu()
    return
  }

  const items = await getStoredGoToItems()
  renderMenuItems(items)
}

const waitForAnchorAndMount = (): void => {
  waitForAnchorCleanup?.()
  waitForAnchorCleanup = runWhenAnyElementExists(BUTTON_ANCHOR_SELECTORS, (anchor) => {
    void getStoredGoToMenuEnabled().then((isEnabled) => {
      if (!isEnabled) return
      mountButton(anchor)
    })
  })
}

const applyEnabledState = async (enabled: boolean): Promise<void> => {
  if (!enabled) {
    hideButtonAndMenu()
    return
  }

  const anchor = resolveAnchor()
  if (anchor) {
    mountButton(anchor)
    await refreshMenuItems()
    return
  }

  waitForAnchorAndMount()
}

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    ensureGoToStyles()

    const refresh = (): Promise<void> => {
      refreshPromise ??= (async () => {
        const enabled = await getStoredGoToMenuEnabled()
        await applyEnabledState(enabled)
      })().finally(() => {
        refreshPromise = undefined
      })

      return refreshPromise
    }

    void refresh()

    const scheduleRefresh = (): void => {
      void refresh().catch((error: unknown) => {
        console.warn('[nmap_uploader] go-to menu refresh failed:', error)
      })
    }

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (area !== 'local') return
      if (!(GO_TO_MENU_ENABLED_STORAGE_KEY in changes) && !(GO_TO_ITEMS_STORAGE_KEY in changes)) {
        return
      }

      scheduleRefresh()
    }

    const handleRuntimeMessage = (message: { action?: string }): void => {
      if (message?.action !== GO_TO_REFRESH_ACTION) return
      scheduleRefresh()
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    ctx.onInvalidated(() => {
      browser.storage.onChanged.removeListener(handleStorageChange)
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
      removeButtonAndMenu()
    })
  },
})
