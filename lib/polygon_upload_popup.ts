import { browser } from 'wxt/browser'

export const POLYGON_UPLOAD_POPUP_ID = 'polygonUploadPopup'
export const POLYGON_UPLOAD_IFRAME_CLASS = 'nmap-uploader-polygon-popup__iframe'

const POPUP_PAGE = '/polygon-upload.html'
const VIEWPORT_MARGIN = 12
const BUTTON_GAP = 10

let popup: HTMLDivElement | null = null
let activeButton: HTMLElement | null = null

const positionPopup = (): void => {
  if (!popup || !activeButton) return

  const buttonRect = activeButton.getBoundingClientRect()
  const availableHeight = Math.max(buttonRect.top - BUTTON_GAP - VIEWPORT_MARGIN, 0)
  const popupWidth = popup.getBoundingClientRect().width
  const maxLeft = Math.max(document.documentElement.clientWidth - popupWidth - VIEWPORT_MARGIN, 0)

  popup.style.bottom = `${document.documentElement.clientHeight - buttonRect.top + BUTTON_GAP}px`
  popup.style.left = `${Math.max(Math.min(buttonRect.left, maxLeft), VIEWPORT_MARGIN)}px`
  popup.style.maxHeight = `${availableHeight}px`
}

const handleDocumentClick = (event: MouseEvent): void => {
  const target = event.target
  if (!(target instanceof Node)) return
  if (popup?.contains(target) || activeButton?.contains(target)) return
  closePolygonUploadPopup()
}

const handleDocumentKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    closePolygonUploadPopup()
  }
}

const removePopupListeners = (): void => {
  document.removeEventListener('click', handleDocumentClick, true)
  document.removeEventListener('keydown', handleDocumentKeyDown)
  window.removeEventListener('resize', positionPopup)
}

const addPopupListeners = (): void => {
  document.addEventListener('click', handleDocumentClick, true)
  document.addEventListener('keydown', handleDocumentKeyDown)
  window.addEventListener('resize', positionPopup)
}

const createPolygonUploadPopup = (button: HTMLElement): HTMLDivElement => {
  const element = document.createElement('div')
  element.id = POLYGON_UPLOAD_POPUP_ID
  element.className =
    'nk-popup nk-popup_visible nk-popup_direction_right-bottom nk-popup_theme_islands nk-popup_restrict-height nmap-uploader-polygon-popup'

  const content = document.createElement('div')
  content.className = 'nk-popup__content nmap-uploader-polygon-popup__content'

  const iframe = document.createElement('iframe')
  iframe.className = POLYGON_UPLOAD_IFRAME_CLASS
  const getRuntimeUrl = browser.runtime.getURL as (path: string) => string
  iframe.src = getRuntimeUrl(POPUP_PAGE)
  iframe.title = button.getAttribute('aria-label') ?? ''

  content.appendChild(iframe)
  element.appendChild(content)
  return element
}

export const isPolygonUploadPopupOpen = (): boolean => popup?.isConnected === true

export const closePolygonUploadPopup = (): void => {
  removePopupListeners()
  popup?.remove()
  activeButton?.setAttribute('aria-expanded', 'false')
  popup = null
  activeButton = null
}

export const togglePolygonUploadPopup = (button: HTMLElement): void => {
  if (isPolygonUploadPopupOpen()) {
    closePolygonUploadPopup()
    return
  }

  activeButton = button
  popup = createPolygonUploadPopup(button)
  button.setAttribute('aria-expanded', 'true')
  document.documentElement.appendChild(popup)
  positionPopup()
  addPopupListeners()
}

export const teardownPolygonUploadPopup = (): void => {
  closePolygonUploadPopup()
}
