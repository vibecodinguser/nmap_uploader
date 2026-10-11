import { GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'
import { createMapIframePopup } from '@/lib/map_iframe_popup'

export const NOTES_POPUP_ID = 'notesPopup'
export const NOTES_IFRAME_CLASS = 'nmap-uploader-polygon-popup__iframe'

const popup = createMapIframePopup({
  popupId: NOTES_POPUP_ID,
  pagePath: '/notes.html',
  popupClassName: `nmap-uploader-popup ${GO_TO_POPUP_VISIBLE_CLASS} nmap-uploader-polygon-popup`,
  contentClassName: 'nmap-uploader-polygon-popup__content',
  iframeClassName: NOTES_IFRAME_CLASS,
})

export const isNotesPopupOpen = popup.isOpen
export const closeNotesPopup = popup.close
export const toggleNotesPopup = popup.toggle
export const teardownNotesPopup = popup.teardown
