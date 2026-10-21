/**
 * Поиск, монтирование и ремонт кнопок тулбара Народной карты.
 */
import { isElementDescendantToOrEquals, queryAllByDomId } from '@/lib/go_to_dom'
import {
  createGoToServiceButton,
  GO_TO_BUTTON_HIDDEN_CLASS,
  GO_TO_SERVICE_BUTTON_ICON_SVG,
  GO_TO_SERVICE_BUTTON_ID,
} from '@/lib/go_to_service_button'
import {
  createSplitViewButton,
  GO_TO_SPLIT_BUTTON_HIDDEN_CLASS,
  GO_TO_SPLIT_BUTTON_ICON_SVG,
  GO_TO_SPLIT_BUTTON_ID,
} from '@/lib/go_to_split_button'
import { repairAllGoToToolbarIcons, type shouldRemountGoToToolbar } from '@/lib/go_to_toolbar'
import { createNotesButton, NOTES_BUTTON_ICON_SVG, NOTES_BUTTON_ID } from '@/lib/notes_button'
import {
  createPolygonUploadButton,
  POLYGON_UPLOAD_BUTTON_ICON_SVG,
  POLYGON_UPLOAD_BUTTON_ID,
} from '@/lib/polygon_upload_button'

export const BUTTON_ANCHOR_SELECTORS = [
  '.nk-map-region-view__button .nk-icon_id_ymaps',
  '.nk-map-region-view__button_id_ymaps',
  '.nk-icon_id_ymaps',
] as const

export const REGION_BUTTON_CLASSES = [
  'nk-map-region-view__button',
  'nk-map-region-view__button_id_goto',
] as const

export const resolveAnchor = (): Element | null => {
  for (const selector of BUTTON_ANCHOR_SELECTORS) {
    const found = document.querySelector(selector)
    if (found instanceof Element) {
      return found
    }
  }
  return null
}

export const getButtonInsertParent = (anchor: Element): HTMLElement | null => {
  const parent = anchor.parentElement
  return parent instanceof HTMLElement ? parent : null
}

export const getServiceButton = (): HTMLElement | null =>
  document.getElementById(GO_TO_SERVICE_BUTTON_ID)

export const getSplitButton = (): HTMLButtonElement | null =>
  document.getElementById(GO_TO_SPLIT_BUTTON_ID) as HTMLButtonElement | null

export const getPolygonUploadButton = (): HTMLButtonElement | null =>
  document.getElementById(POLYGON_UPLOAD_BUTTON_ID) as HTMLButtonElement | null

export const getNotesButton = (): HTMLButtonElement | null =>
  document.getElementById(NOTES_BUTTON_ID) as HTMLButtonElement | null

export const isButtonMountedInToolbar = (button: HTMLElement, anchor: Element): boolean => {
  const goToServiceButton = getServiceButton()
  if (!goToServiceButton) return false

  if (button === goToServiceButton) {
    const insertParent = getButtonInsertParent(anchor)
    return insertParent?.nextElementSibling === button
  }

  const toolbarSplitButton = getSplitButton()
  if (button === toolbarSplitButton) {
    return goToServiceButton.nextElementSibling === button
  }

  return false
}

export const isSplitButtonSiblingOf = (
  splitButton: HTMLButtonElement,
  goToServiceButton: HTMLElement,
): boolean => splitButton.previousElementSibling === goToServiceButton

export const hideGoToServiceButton = (): void => {
  const button = getServiceButton()
  if (button) {
    button.classList.add(GO_TO_BUTTON_HIDDEN_CLASS)
    button.setAttribute('aria-hidden', 'true')
    for (const className of REGION_BUTTON_CLASSES) {
      button.classList.remove(className)
    }
  }
}

export const showGoToServiceButton = (): void => {
  const button = getServiceButton()
  if (button) {
    button.classList.remove(GO_TO_BUTTON_HIDDEN_CLASS)
    button.removeAttribute('aria-hidden')
    for (const className of REGION_BUTTON_CLASSES) {
      button.classList.add(className)
    }
  }
}

export const showSplitButton = (): void => {
  const splitButton = getSplitButton()
  if (splitButton) {
    splitButton.classList.remove(GO_TO_SPLIT_BUTTON_HIDDEN_CLASS)
    splitButton.removeAttribute('aria-hidden')
    for (const className of REGION_BUTTON_CLASSES) {
      splitButton.classList.add(className)
    }
  }
}

export const isToolbarButtonHoverTarget = (
  button: HTMLElement | null,
  eventTarget: EventTarget | null,
  buttonId: string,
): button is HTMLElement => button !== null && isElementDescendantToOrEquals(eventTarget, buttonId)

export const getGoToToolbarMountState = (
  anchor: Element,
): Parameters<typeof shouldRemountGoToToolbar>[0] => {
  const goToServiceButtons = queryAllByDomId(GO_TO_SERVICE_BUTTON_ID)
  const splitButtons = queryAllByDomId(GO_TO_SPLIT_BUTTON_ID)
  const uploadButtons = queryAllByDomId(POLYGON_UPLOAD_BUTTON_ID)
  const notesButtons = queryAllByDomId(NOTES_BUTTON_ID)
  const goToServiceButton = goToServiceButtons[0] ?? null

  const isGoToMountedCorrectly = goToServiceButton
    ? isButtonMountedInToolbar(goToServiceButton, anchor)
    : true

  const isSplitSiblingCorrect =
    goToServiceButton && splitButtons[0]
      ? splitButtons[0].previousElementSibling === goToServiceButton
      : true

  const expectedUploadPrevious = splitButtons[0] ?? goToServiceButton
  const isUploadSiblingCorrect = uploadButtons[0]
    ? expectedUploadPrevious !== null &&
      uploadButtons[0].previousElementSibling === expectedUploadPrevious
    : true

  const isNotesSiblingCorrect = notesButtons[0]
    ? uploadButtons[0] !== undefined && notesButtons[0].previousElementSibling === uploadButtons[0]
    : true

  return {
    goToCount: goToServiceButtons.length,
    splitCount: splitButtons.length,
    uploadCount: uploadButtons.length,
    notesCount: notesButtons.length,
    isGoToMountedCorrectly,
    isSplitSiblingCorrect,
    isUploadSiblingCorrect,
    isNotesSiblingCorrect,
  }
}

export const repairToolbarIcons = (): void => {
  repairAllGoToToolbarIcons({
    [GO_TO_SERVICE_BUTTON_ID]: GO_TO_SERVICE_BUTTON_ICON_SVG,
    [GO_TO_SPLIT_BUTTON_ID]: GO_TO_SPLIT_BUTTON_ICON_SVG,
    [POLYGON_UPLOAD_BUTTON_ID]: POLYGON_UPLOAD_BUTTON_ICON_SVG,
    [NOTES_BUTTON_ID]: NOTES_BUTTON_ICON_SVG,
  })
}
