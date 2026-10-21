/**
 * Изолированные фабрики и обработчики вспомогательных кнопок тулбара (Сплит, Полигоны, Заметки).
 */
import {
  getNotesButton,
  getPolygonUploadButton,
  getServiceButton,
  getSplitButton,
  isSplitButtonSiblingOf,
  isToolbarButtonHoverTarget,
  showSplitButton,
} from '@/lib/go_to/toolbar_mount'
import { hideGoToTooltip, showGoToTooltip } from '@/lib/go_to_dom'
import { createSplitViewButton, GO_TO_SPLIT_BUTTON_ID } from '@/lib/go_to_split_button'
import { toggleSplitView } from '@/lib/go_to_split_view'
import { GO_TO_BUTTON_HOVERED_CLASS } from '@/lib/go_to_styles'
import type { TranslateFn } from '@/lib/i18n'
import { createNotesButton, NOTES_BUTTON_ID } from '@/lib/notes_button'
import { closeNotesPopup, toggleNotesPopup } from '@/lib/notes_popup'
import { createPolygonUploadButton, POLYGON_UPLOAD_BUTTON_ID } from '@/lib/polygon_upload_button'
import { closePolygonUploadPopup, togglePolygonUploadPopup } from '@/lib/polygon_upload_popup'

export interface ToolbarActionContext {
  getTranslator: () => TranslateFn
  onHideMenu: () => void
}

export const mountSplitButtonView = ({ getTranslator, onHideMenu }: ToolbarActionContext): void => {
  const goToServiceButton = getServiceButton()
  if (!goToServiceButton) return

  const existing = getSplitButton()
  if (existing && !isSplitButtonSiblingOf(existing, goToServiceButton)) {
    existing.remove()
  }

  if (!getSplitButton()) {
    const label = getTranslator()('map.splitView')
    const btn = createSplitViewButton(label)
    goToServiceButton.insertAdjacentElement('afterend', btn)
    const created = getSplitButton()
    if (created) {
      created.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        onHideMenu()
        closePolygonUploadPopup()
        closeNotesPopup()
        toggleSplitView()
      })
      created.addEventListener('mouseover', (e) => {
        if (isToolbarButtonHoverTarget(created, e.target, GO_TO_SPLIT_BUTTON_ID)) {
          created.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
          showGoToTooltip(getTranslator()('map.splitView'), created, 'top')
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

export const mountPolygonUploadButtonView = ({
  getTranslator,
  onHideMenu,
}: ToolbarActionContext): void => {
  const serviceButton = getServiceButton()
  if (!serviceButton) return

  const insertAfter = getSplitButton() ?? serviceButton
  const existingButton = getPolygonUploadButton()
  if (existingButton && existingButton.previousElementSibling !== insertAfter) {
    closePolygonUploadPopup()
    existingButton.remove()
  }

  if (!getPolygonUploadButton()) {
    const label = getTranslator()('map.uploadPolygons')
    const button = createPolygonUploadButton(label)
    insertAfter.insertAdjacentElement('afterend', button)

    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      onHideMenu()
      closeNotesPopup()
      togglePolygonUploadPopup(button)
    })
    button.addEventListener('mouseover', (e) => {
      if (isToolbarButtonHoverTarget(button, e.target, POLYGON_UPLOAD_BUTTON_ID)) {
        button.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
        showGoToTooltip(getTranslator()('map.uploadPolygons'), button, 'top')
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

export const mountNotesButtonView = ({ getTranslator, onHideMenu }: ToolbarActionContext): void => {
  const uploadButton = getPolygonUploadButton()
  if (!uploadButton) return

  const existingButton = getNotesButton()
  if (existingButton && existingButton.previousElementSibling !== uploadButton) {
    closeNotesPopup()
    existingButton.remove()
  }

  if (!getNotesButton()) {
    const button = createNotesButton(getTranslator()('map.notes'))
    uploadButton.insertAdjacentElement('afterend', button)

    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      onHideMenu()
      closePolygonUploadPopup()
      toggleNotesPopup(button)
    })
    button.addEventListener('mouseover', (e) => {
      if (isToolbarButtonHoverTarget(button, e.target, NOTES_BUTTON_ID)) {
        button.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
        showGoToTooltip(getTranslator()('map.notes'), button, 'top')
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
