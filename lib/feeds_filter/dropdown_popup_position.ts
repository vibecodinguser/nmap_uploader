export interface PopupPositionOptions {
  referenceElement: HTMLElement
  popupElement: HTMLElement
  offsetY?: number
}

export const positionPopupFixed = ({
  referenceElement,
  popupElement,
  offsetY = 4,
}: PopupPositionOptions): void => {
  const rect = referenceElement.getBoundingClientRect()
  popupElement.style.position = 'fixed'
  popupElement.style.top = `${Math.round(rect.bottom + offsetY)}px`
  popupElement.style.left = `${Math.round(rect.left)}px`
  popupElement.style.display = 'block'
  popupElement.style.visibility = 'visible'
  popupElement.style.opacity = '1'
}

export const hidePopup = (popupElement: HTMLElement): void => {
  popupElement.style.display = 'none'
  popupElement.style.visibility = 'hidden'
  popupElement.classList.remove('nk-popup_visible')
}
