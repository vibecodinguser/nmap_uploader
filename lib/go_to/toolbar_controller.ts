/**
 * Контроллер сборки тулбара Народной карты: кнопки Перейти, Сплит, Загрузка, Заметки.
 */

import { createGoToMenuElement, MENU_ID, MENU_ITEMS_ID } from '@/lib/go_to/menu_dom'
import {
  getButtonInsertParent,
  getGoToToolbarMountState,
  getNotesButton,
  getPolygonUploadButton,
  getServiceButton,
  getSplitButton,
  hideGoToServiceButton,
  isButtonMountedInToolbar,
  isSplitButtonSiblingOf,
  isToolbarButtonHoverTarget,
  repairToolbarIcons,
  resolveAnchor,
  showGoToServiceButton,
  showSplitButton,
} from '@/lib/go_to/toolbar_mount'
import { hideGoToTooltip, showGoToTooltip } from '@/lib/go_to_dom'
import { createGoToServiceButton, GO_TO_SERVICE_BUTTON_ID } from '@/lib/go_to_service_button'
import {
  type GoToItem,
  getActiveGoToItems,
  getStoredGoToItems,
  getStoredGoToMenuEnabled,
} from '@/lib/go_to_settings'
import {
  createSplitViewButton,
  GO_TO_SPLIT_BUTTON_ID,
  getStoredSplitButtonEnabled,
} from '@/lib/go_to_split_button'
import { isSplitViewOpen, teardownSplitView, toggleSplitView } from '@/lib/go_to_split_view'
import { GO_TO_BUTTON_HOVERED_CLASS, GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'
import { removeAllGoToToolbarButtons, shouldRemountGoToToolbar } from '@/lib/go_to_toolbar'
import type { TranslateFn } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/locale.types'
import { createNotesButton, getStoredNotesButtonEnabled, NOTES_BUTTON_ID } from '@/lib/notes_button'
import { closeNotesPopup, teardownNotesPopup, toggleNotesPopup } from '@/lib/notes_popup'
import { createPolygonUploadButton, POLYGON_UPLOAD_BUTTON_ID } from '@/lib/polygon_upload_button'
import {
  closePolygonUploadPopup,
  teardownPolygonUploadPopup,
  togglePolygonUploadPopup,
} from '@/lib/polygon_upload_popup'

export type GoToToolbarSettings = readonly [boolean, boolean, boolean]

export const loadGoToToolbarSettings = (): Promise<GoToToolbarSettings> => {
  const menuEnabledPromise = getStoredGoToMenuEnabled()
  const splitButtonEnabledPromise = getStoredSplitButtonEnabled()
  const notesButtonEnabledPromise = getStoredNotesButtonEnabled()
  return Promise.all([menuEnabledPromise, splitButtonEnabledPromise, notesButtonEnabledPromise])
}

export class GoToToolbarController {
  private toolbarButtonListeners = new WeakMap<HTMLElement, AbortController>()

  constructor(
    private readonly getTranslator: () => TranslateFn,
    private readonly getLocale: () => Locale,
    private readonly onOpenMenu: () => void,
    private readonly onHideMenu: () => void,
    private readonly onRenderMenuItems: (items: GoToItem[]) => void,
  ) {}

  public ensureMenu(): void {
    if (!document.getElementById(MENU_ID)) {
      const createdMenu = createGoToMenuElement()
      document.documentElement.appendChild(createdMenu)
    }
  }

  public async buildMenu(): Promise<void> {
    this.ensureMenu()
    const items = await getStoredGoToItems()
    this.onRenderMenuItems(getActiveGoToItems(items))
  }

  public removeMenu(): void {
    document.getElementById(MENU_ID)?.remove()
  }

  public removeSplitButton(): void {
    teardownSplitView()
    getSplitButton()?.remove()
  }

  public removeNotesButton(): void {
    closeNotesPopup()
    teardownNotesPopup()
    getNotesButton()?.remove()
  }

  public removeButtonAndMenu(): void {
    hideGoToTooltip()
    this.removeMenu()
    teardownSplitView()
    teardownPolygonUploadPopup()
    teardownNotesPopup()
    removeAllGoToToolbarButtons()
  }

  public hideGoToMenuOnly(): void {
    hideGoToTooltip()
    this.onHideMenu()
    hideGoToServiceButton()
  }

  public mountToolbar(
    anchor: Element,
    menuEnabled: boolean,
    splitButtonEnabled: boolean,
    notesButtonEnabled: boolean,
  ): void {
    const parent = getButtonInsertParent(anchor)
    if (!parent) return

    const toolbarMountState = getGoToToolbarMountState(anchor)
    if (shouldRemountGoToToolbar(toolbarMountState)) {
      closePolygonUploadPopup()
      closeNotesPopup()
      removeAllGoToToolbarButtons()
    }

    const existingServiceButton = getServiceButton()
    if (!existingServiceButton) {
      const goToServiceButtonElement = createGoToServiceButton()
      parent.insertAdjacentElement('afterend', goToServiceButtonElement)
      const createdServiceButton = getServiceButton()
      if (createdServiceButton) {
        createdServiceButton.addEventListener('click', () => {
          closePolygonUploadPopup()
          closeNotesPopup()
          this.onOpenMenu()
        })
        createdServiceButton.addEventListener('mouseover', (e) => {
          if (isToolbarButtonHoverTarget(createdServiceButton, e.target, GO_TO_SERVICE_BUTTON_ID)) {
            createdServiceButton.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
            const label = this.getTranslator()('map.externalGeoservices')
            showGoToTooltip(label, createdServiceButton, 'top')
          }
        })
        createdServiceButton.addEventListener('mouseout', (e) => {
          if (isToolbarButtonHoverTarget(createdServiceButton, e.target, GO_TO_SERVICE_BUTTON_ID)) {
            createdServiceButton.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
            hideGoToTooltip()
          }
        })
      }
    }

    if (menuEnabled) {
      showGoToServiceButton()
      void this.buildMenu().catch((err) => console.warn('[nmap_uploader] menu build failed:', err))
    } else {
      this.hideGoToMenuOnly()
    }

    if (splitButtonEnabled) {
      this.mountSplitButton()
    } else {
      this.removeSplitButton()
    }

    this.mountPolygonUploadButton()

    if (notesButtonEnabled) {
      this.mountNotesButton()
    } else {
      this.removeNotesButton()
    }

    repairToolbarIcons()
  }

  public mountSplitButton(): void {
    const goToServiceButton = getServiceButton()
    if (!goToServiceButton) return

    const existing = getSplitButton()
    if (existing && !isSplitButtonSiblingOf(existing, goToServiceButton)) {
      existing.remove()
    }

    if (!getSplitButton()) {
      const label = this.getTranslator()('map.splitView')
      const btn = createSplitViewButton(label)
      goToServiceButton.insertAdjacentElement('afterend', btn)
      const created = getSplitButton()
      if (created) {
        created.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          this.onHideMenu()
          closePolygonUploadPopup()
          closeNotesPopup()
          toggleSplitView()
        })
        created.addEventListener('mouseover', (e) => {
          if (isToolbarButtonHoverTarget(created, e.target, GO_TO_SPLIT_BUTTON_ID)) {
            created.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
            showGoToTooltip(this.getTranslator()('map.splitView'), created, 'top')
          }
        })
        created.addEventListener('mouseout', (e) => {
          if (isToolbarButtonHoverTarget(created, e.target, GO_TO_SPLIT_BUTTON_ID)) {
            created.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
            hideGoToTooltip()
          }
        })
      }
    }

    showSplitButton()
  }

  public mountPolygonUploadButton(): void {
    const serviceButton = getServiceButton()
    if (!serviceButton) return

    const insertAfter = getSplitButton() ?? serviceButton
    const existingButton = getPolygonUploadButton()
    if (existingButton && existingButton.previousElementSibling !== insertAfter) {
      closePolygonUploadPopup()
      existingButton.remove()
    }

    if (!getPolygonUploadButton()) {
      const label = this.getTranslator()('map.uploadPolygons')
      const button = createPolygonUploadButton(label)
      insertAfter.insertAdjacentElement('afterend', button)

      button.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        this.onHideMenu()
        closeNotesPopup()
        togglePolygonUploadPopup(button)
      })
      button.addEventListener('mouseover', (e) => {
        if (isToolbarButtonHoverTarget(button, e.target, POLYGON_UPLOAD_BUTTON_ID)) {
          button.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
          showGoToTooltip(this.getTranslator()('map.uploadPolygons'), button, 'top')
        }
      })
      button.addEventListener('mouseout', (e) => {
        if (isToolbarButtonHoverTarget(button, e.target, POLYGON_UPLOAD_BUTTON_ID)) {
          button.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
          hideGoToTooltip()
        }
      })
    }
  }

  public mountNotesButton(): void {
    const uploadButton = getPolygonUploadButton()
    if (!uploadButton) return

    const existingButton = getNotesButton()
    if (existingButton && existingButton.previousElementSibling !== uploadButton) {
      closeNotesPopup()
      existingButton.remove()
    }

    if (!getNotesButton()) {
      const button = createNotesButton(this.getTranslator()('map.notes'))
      uploadButton.insertAdjacentElement('afterend', button)

      button.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        this.onHideMenu()
        closePolygonUploadPopup()
        toggleNotesPopup(button)
      })
      button.addEventListener('mouseover', (e) => {
        if (isToolbarButtonHoverTarget(button, e.target, NOTES_BUTTON_ID)) {
          button.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
          showGoToTooltip(this.getTranslator()('map.notes'), button, 'top')
        }
      })
      button.addEventListener('mouseout', (e) => {
        if (isToolbarButtonHoverTarget(button, e.target, NOTES_BUTTON_ID)) {
          button.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
          hideGoToTooltip()
        }
      })
    }
  }
}
