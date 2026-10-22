/**
 * Контроллер сборки тулбара Народной карты: кнопки Перейти, Сплит, Загрузка, Заметки.
 */

import { createGoToMenuElement, MENU_ID } from '@/lib/go_to/menu_dom'
import {
  getButtonInsertParent,
  getGoToToolbarMountState,
  getNotesButton,
  getServiceButton,
  getSplitButton,
  hideGoToServiceButton,
  isToolbarButtonHoverTarget,
  repairToolbarIcons,
  showGoToServiceButton,
} from '@/lib/go_to/toolbar_mount'
import { hideGoToTooltip, showGoToTooltip } from '@/lib/go_to_dom'
import { createGoToServiceButton, GO_TO_SERVICE_BUTTON_ID } from '@/lib/go_to_service_button'
import { type GoToItem, getActiveGoToItems, getStoredGoToItems } from '@/lib/go_to_settings'
import { teardownSplitView } from '@/lib/go_to_split_view'
import { GO_TO_BUTTON_HOVERED_CLASS } from '@/lib/go_to_styles'
import { removeAllGoToToolbarButtons, shouldRemountGoToToolbar } from '@/lib/go_to_toolbar'
import type { TranslateFn } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/locale.types'
import { closeNotesPopup, teardownNotesPopup } from '@/lib/notes_popup'
import { closePolygonUploadPopup, teardownPolygonUploadPopup } from '@/lib/polygon_upload_popup'
import {
  mountNotesButtonView,
  mountPolygonUploadButtonView,
  mountSplitButtonView,
} from './toolbar_buttons_mount'

export * from './toolbar_buttons_mount'
export * from './toolbar_settings_loader'

export class GoToToolbarController {
  constructor(
    private readonly getTranslator: () => TranslateFn,
    readonly getLocale: () => Locale,
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
    mountSplitButtonView({
      getTranslator: this.getTranslator,
      onHideMenu: this.onHideMenu,
    })
  }

  public mountPolygonUploadButton(): void {
    mountPolygonUploadButtonView({
      getTranslator: this.getTranslator,
      onHideMenu: this.onHideMenu,
    })
  }

  public mountNotesButton(): void {
    mountNotesButtonView({
      getTranslator: this.getTranslator,
      onHideMenu: this.onHideMenu,
    })
  }
}
