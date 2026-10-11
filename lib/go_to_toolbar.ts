import { queryAllByDomId } from '@/lib/go_to_dom'
import { GO_TO_SERVICE_BUTTON_ID } from '@/lib/go_to_service_button'
import { GO_TO_SPLIT_BUTTON_ID } from '@/lib/go_to_split_button'
import { NOTES_BUTTON_ID } from '@/lib/notes_button'
import { parseStaticSvg } from '@/lib/parse_static_svg'
import { POLYGON_UPLOAD_BUTTON_ID } from '@/lib/polygon_upload_button'

const GO_TO_ICON_SELECTOR = '.nmap-uploader-goto-icon'

export type GoToToolbarMountState = {
  goToCount: number
  splitCount: number
  uploadCount: number
  notesCount: number
  isGoToMountedCorrectly: boolean
  isSplitSiblingCorrect: boolean
  isUploadSiblingCorrect: boolean
  isNotesSiblingCorrect: boolean
}

/** Определяет, нужно ли полностью пересоздать кнопки go-to на панели карты. */
export const shouldRemountGoToToolbar = (state: GoToToolbarMountState): boolean => {
  const {
    goToCount,
    splitCount,
    uploadCount,
    notesCount,
    isGoToMountedCorrectly,
    isSplitSiblingCorrect,
    isUploadSiblingCorrect,
    isNotesSiblingCorrect,
  } = state
  let needsRemount = false

  if (goToCount > 1 || splitCount > 1 || uploadCount > 1 || notesCount > 1) {
    needsRemount = true
  } else if (goToCount === 1 && !isGoToMountedCorrectly) {
    needsRemount = true
  } else if (splitCount === 1 && !isSplitSiblingCorrect) {
    needsRemount = true
  } else if (uploadCount === 1 && !isUploadSiblingCorrect) {
    needsRemount = true
  } else if (notesCount === 1 && !isNotesSiblingCorrect) {
    needsRemount = true
  }

  return needsRemount
}

/** Удаляет все кнопки go-to и split-view, включая дубликаты с одинаковым id. */
export const removeAllGoToToolbarButtons = (): void => {
  for (const id of [
    GO_TO_SERVICE_BUTTON_ID,
    GO_TO_SPLIT_BUTTON_ID,
    POLYGON_UPLOAD_BUTTON_ID,
    NOTES_BUTTON_ID,
  ]) {
    removeButtonsById(id)
  }
}

const removeButtonsById = (id: string): void => {
  for (const element of queryAllByDomId(id)) {
    element.remove()
  }
}

/** Восстанавливает SVG внутри host-элемента, если он пропал после перерисовки страницы. */
export const repairGoToIconHost = (iconHost: Element | null, iconSvg: string): boolean => {
  if (!(iconHost instanceof HTMLElement)) {
    return false
  }

  if (iconHost.querySelector('svg')) {
    return false
  }

  iconHost.replaceChildren(parseStaticSvg(iconSvg))
  return true
}

/** Восстанавливает SVG-иконки на всех кнопках go-to в DOM. */
export const repairAllGoToToolbarIcons = (iconSvgByButtonId: Record<string, string>): number => {
  let repaired = 0

  for (const [buttonId, iconSvg] of Object.entries(iconSvgByButtonId)) {
    for (const button of queryAllByDomId(buttonId)) {
      const iconHost = button.querySelector(GO_TO_ICON_SELECTOR)
      if (repairGoToIconHost(iconHost, iconSvg)) {
        repaired += 1
      }
    }
  }

  return repaired
}
