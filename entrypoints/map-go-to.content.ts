import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import {
  hideGoToTooltip,
  isElementDescendantToOrEquals,
  queryAllByDomId,
  runWhenAnyElementExists,
  showGoToTooltip,
} from '@/lib/go_to_dom'
import { buildGoToLink, getMapLocationFromUrl } from '@/lib/go_to_link'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import {
  createGoToServiceButton,
  GO_TO_BUTTON_HIDDEN_CLASS,
  GO_TO_SERVICE_BUTTON_ICON_SVG,
  GO_TO_SERVICE_BUTTON_ID,
} from '@/lib/go_to_service_button'
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
  createSplitViewButton,
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  GO_TO_SPLIT_BUTTON_HIDDEN_CLASS,
  GO_TO_SPLIT_BUTTON_ICON_SVG,
  GO_TO_SPLIT_BUTTON_ID,
  getStoredSplitButtonEnabled,
} from '@/lib/go_to_split_button'
import { isSplitViewOpen, teardownSplitView, toggleSplitView } from '@/lib/go_to_split_view'
import {
  ensureGoToStyles,
  GO_TO_BUTTON_HOVERED_CLASS,
  GO_TO_MENU_ITEM_HOVERED_CLASS,
  GO_TO_POPUP_VISIBLE_CLASS,
} from '@/lib/go_to_styles'
import {
  removeAllGoToToolbarButtons,
  repairAllGoToToolbarIcons,
  shouldRemountGoToToolbar,
} from '@/lib/go_to_toolbar'

const BUTTON_ANCHOR_SELECTORS = [
  '.nk-map-region-view__button .nk-icon_id_ymaps',
  '.nk-map-region-view__button_id_ymaps',
  '.nk-icon_id_ymaps',
] as const

const SERVICE_BUTTON_ID = GO_TO_SERVICE_BUTTON_ID
const SPLIT_BUTTON_ID = GO_TO_SPLIT_BUTTON_ID
const MENU_ID = 'goToLinksMenu'
const MENU_ITEMS_ID = 'linksItems'

const REGION_BUTTON_CLASSES = [
  'nk-map-region-view__button',
  'nk-map-region-view__button_id_goto',
] as const

const createGoToMenuElement = (): HTMLElement => {
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
  return menu
}

const createMenuItemElement = (item: GoToItem, iconUrl: string): HTMLDivElement => {
  const menuItem = document.createElement('div')
  menuItem.id = `goToLink${item.name}`
  menuItem.className = 'nmap-uploader-menu__item'
  menuItem.setAttribute('role', 'menuitem')
  menuItem.style.backgroundImage = `url("${iconUrl}")`
  menuItem.textContent = getGoToSourceDisplayName(item.name)
  return menuItem
}

const getServiceButton = (): HTMLElement | null => document.getElementById(SERVICE_BUTTON_ID)
const getSplitButton = (): HTMLButtonElement | null =>
  document.getElementById(SPLIT_BUTTON_ID) as HTMLButtonElement | null
const getMenu = (): HTMLElement | null => document.getElementById(MENU_ID)
const getMenuItems = (): HTMLElement | null => document.getElementById(MENU_ITEMS_ID)

let waitForAnchorCleanup: (() => void) | undefined
let refreshPromise: Promise<void> | undefined
let isRefreshScheduled = false

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

const hideGoToServiceButton = (): void => {
  const button = getServiceButton()
  if (!button) return

  button.classList.add(GO_TO_BUTTON_HIDDEN_CLASS)
  button.setAttribute('aria-hidden', 'true')
  for (const className of REGION_BUTTON_CLASSES) {
    button.classList.remove(className)
  }
}

const showGoToServiceButton = (): void => {
  const button = getServiceButton()
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
  teardownSplitView()
  removeAllGoToToolbarButtons()
}

const hideGoToMenuOnly = (): void => {
  hideGoToTooltip()
  hideMenu()
  hideGoToServiceButton()
}

const hideButtonAndMenu = (): void => {
  waitForAnchorCleanup?.()
  waitForAnchorCleanup = undefined
  hideGoToTooltip()
  hideMenu()
  if (isSplitViewOpen()) teardownSplitView()
  hideGoToServiceButton()
  hideSplitButton()
}

const renderMenuItems = (items: GoToItem[]): void => {
  const menuItems = getMenuItems()
  if (!menuItems) return

  menuItems.replaceChildren()

  for (const item of getActiveGoToItems(items)) {
    const iconUrl = getGoToSourceIconUrl(item.name)
    const menuItem = createMenuItemElement(item, iconUrl)

    menuItem.addEventListener('mouseover', handleMenuItemMouseOver)
    menuItem.addEventListener('mouseout', handleMenuItemMouseOut)
    menuItem.addEventListener('click', handleMenuItemClick)
    menuItem.addEventListener('auxclick', handleMenuItemAuxClick)
    menuItems.appendChild(menuItem)
  }
}

const ensureMenu = (): void => {
  if (getMenu()) return
  document.body.appendChild(createGoToMenuElement())
}

const buildMenu = async (): Promise<void> => {
  ensureMenu()
  const items = await getStoredGoToItems()
  renderMenuItems(items)
}

const isButtonMountedInToolbar = (button: HTMLElement, anchor: Element): boolean => {
  const goToServiceButton = getServiceButton()
  if (!goToServiceButton) return false

  let expectedPrevious: Element | null = getButtonInsertParent(anchor)
  if (button === goToServiceButton) {
    return expectedPrevious?.nextElementSibling === button
  }

  const splitButton = getSplitButton()
  if (button === splitButton) {
    expectedPrevious = goToServiceButton
    return expectedPrevious?.nextElementSibling === button
  }

  return false
}

const mountSplitButton = (): void => {
  const goToServiceButton = getServiceButton()
  if (!goToServiceButton) return

  let splitButton = getSplitButton()
  if (splitButton && splitButton.previousElementSibling !== goToServiceButton) {
    splitButton.remove()
    splitButton = null
  }

  if (!splitButton) {
    goToServiceButton.insertAdjacentElement('afterend', createSplitViewButton())
    splitButton = getSplitButton()
    if (!splitButton) return

    splitButton.addEventListener('click', handleSplitButtonClick)
    splitButton.addEventListener('mouseover', handleSplitButtonMouseOver)
    splitButton.addEventListener('mouseout', handleSplitButtonMouseOut)
  }

  showSplitButton()
}

const syncSplitButtonState = (splitEnabled: boolean): void => {
  if (!splitEnabled) {
    removeSplitButton()
    return
  }

  void getStoredGoToMenuEnabled().then((menuEnabled) => {
    const anchor = resolveAnchor()
    if (!anchor) return
    mountToolbar(anchor, menuEnabled, true)
  })
}

const getGoToToolbarMountState = (
  anchor: Element,
): Parameters<typeof shouldRemountGoToToolbar>[0] => {
  const goToServiceButtons = queryAllByDomId(GO_TO_SERVICE_BUTTON_ID)
  const splitButtons = queryAllByDomId(GO_TO_SPLIT_BUTTON_ID)
  const goToServiceButton = goToServiceButtons[0] ?? null

  return {
    goToCount: goToServiceButtons.length,
    splitCount: splitButtons.length,
    isGoToMountedCorrectly: goToServiceButton
      ? isButtonMountedInToolbar(goToServiceButton, anchor)
      : true,
    isSplitSiblingCorrect:
      goToServiceButton && splitButtons[0]
        ? splitButtons[0].previousElementSibling === goToServiceButton
        : true,
  }
}

const repairToolbarIcons = (): void => {
  repairAllGoToToolbarIcons({
    [GO_TO_SERVICE_BUTTON_ID]: GO_TO_SERVICE_BUTTON_ICON_SVG,
    [GO_TO_SPLIT_BUTTON_ID]: GO_TO_SPLIT_BUTTON_ICON_SVG,
  })
}

const mountToolbar = (anchor: Element, menuEnabled: boolean, splitButtonEnabled: boolean): void => {
  const parent = getButtonInsertParent(anchor)
  if (!parent) return

  if (shouldRemountGoToToolbar(getGoToToolbarMountState(anchor))) {
    removeAllGoToToolbarButtons()
  }

  let button = getServiceButton()

  if (!button) {
    parent.insertAdjacentElement('afterend', createGoToServiceButton())
    button = getServiceButton()
    if (!button) return

    button.addEventListener('click', handleButtonClick)
    button.addEventListener('mouseover', handleButtonMouseOver)
    button.addEventListener('mouseout', handleButtonMouseOut)
  }

  if (menuEnabled) {
    showGoToServiceButton()
    void buildMenu()
  } else {
    hideGoToMenuOnly()
  }

  if (splitButtonEnabled) {
    mountSplitButton()
  } else {
    removeSplitButton()
  }

  repairToolbarIcons()
}

const hideMenu = (event?: Event): void => {
  if (event?.target && isElementDescendantToOrEquals(event.target, SERVICE_BUTTON_ID)) {
    event.stopPropagation()
  }

  document.body.removeEventListener('click', hideMenu, true)
  getMenu()?.classList.remove(GO_TO_POPUP_VISIBLE_CLASS)
  hideGoToTooltip()
}

const showMenu = (): void => {
  const menu = getMenu()
  const button = getServiceButton()
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
  const button = getServiceButton()
  if (!button || !isElementDescendantToOrEquals(event.target, SERVICE_BUTTON_ID)) return
  button.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
  showGoToTooltip('Внешние геосервисы', button, 'top')
}

const handleButtonMouseOut = (event: MouseEvent): void => {
  const button = getServiceButton()
  if (!button || !isElementDescendantToOrEquals(event.target, SERVICE_BUTTON_ID)) return
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
    void Promise.all([getStoredGoToMenuEnabled(), getStoredSplitButtonEnabled()]).then(
      ([menuEnabled, splitButtonEnabled]) => {
        mountToolbar(anchor, menuEnabled, splitButtonEnabled)
      },
    )
  })
}

const applyEnabledState = async (
  menuEnabled: boolean,
  splitButtonEnabled: boolean,
): Promise<void> => {
  if (!menuEnabled && !splitButtonEnabled) {
    hideButtonAndMenu()
    return
  }

  const anchor = resolveAnchor()
  if (anchor) {
    mountToolbar(anchor, menuEnabled, splitButtonEnabled)
    if (menuEnabled) await refreshMenuItems()
    return
  }

  waitForAnchorAndMount()
}

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    ensureGoToStyles()

    const runRefresh = async (): Promise<void> => {
      if (refreshPromise) {
        isRefreshScheduled = true
        await refreshPromise
        if (!isRefreshScheduled) return
      }

      isRefreshScheduled = false
      refreshPromise = (async () => {
        const [enabled, splitButtonEnabled] = await Promise.all([
          getStoredGoToMenuEnabled(),
          getStoredSplitButtonEnabled(),
        ])
        await applyEnabledState(enabled, splitButtonEnabled)
      })()

      try {
        await refreshPromise
      } finally {
        refreshPromise = undefined
        if (isRefreshScheduled) {
          void runRefresh().catch((error: unknown) => {
            console.warn('[nmap_uploader] go-to menu refresh failed:', error)
          })
        }
      }
    }

    void runRefresh().catch((error: unknown) => {
      console.warn('[nmap_uploader] go-to menu refresh failed:', error)
    })

    const scheduleRefresh = (): void => {
      isRefreshScheduled = true
      void runRefresh().catch((error: unknown) => {
        console.warn('[nmap_uploader] go-to menu refresh failed:', error)
      })
    }

    const handlePageResume = (): void => {
      repairToolbarIcons()
      scheduleRefresh()
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState !== 'visible') return
      handlePageResume()
    }

    const handlePageShow = (event: PageTransitionEvent): void => {
      if (!event.persisted) return
      handlePageResume()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (area !== 'local') return

      if (GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes) {
        const nextSplitEnabled = changes[GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]?.newValue
        if (typeof nextSplitEnabled === 'boolean') {
          syncSplitButtonState(nextSplitEnabled)
        }
      }

      if (GO_TO_MENU_ENABLED_STORAGE_KEY in changes) {
        const nextMenuEnabled = changes[GO_TO_MENU_ENABLED_STORAGE_KEY]?.newValue
        if (typeof nextMenuEnabled === 'boolean') {
          void getStoredSplitButtonEnabled().then((splitButtonEnabled) => {
            const anchor = resolveAnchor()
            if (!anchor) return
            mountToolbar(anchor, nextMenuEnabled, splitButtonEnabled)
          })
        }
      }

      if (
        !(GO_TO_MENU_ENABLED_STORAGE_KEY in changes) &&
        !(GO_TO_ITEMS_STORAGE_KEY in changes) &&
        !(GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes)
      ) {
        return
      }

      scheduleRefresh()
    }

    const handleRuntimeMessage = (message: { action?: string }): void => {
      if (message?.action !== GO_TO_REFRESH_ACTION) return

      void Promise.all([getStoredGoToMenuEnabled(), getStoredSplitButtonEnabled()]).then(
        ([menuEnabled, splitButtonEnabled]) => {
          const anchor = resolveAnchor()
          if (!anchor) return
          mountToolbar(anchor, menuEnabled, splitButtonEnabled)
        },
      )
      scheduleRefresh()
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    ctx.onInvalidated(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
      browser.storage.onChanged.removeListener(handleStorageChange)
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
      removeButtonAndMenu()
    })
  },
})
