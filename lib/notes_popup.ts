import { createMapIframePopup } from '@/lib/map_iframe_popup'

export const NOTES_POPUP_ID = 'notesPopup'
export const NOTES_IFRAME_CLASS = 'nmap-uploader-polygon-popup__iframe'

const popup = createMapIframePopup({
  popupId: NOTES_POPUP_ID,
  pagePath: '/notes.html',
  popupClassName:
    'nk-popup nk-popup_visible nk-popup_direction_right-bottom nk-popup_theme_islands nk-popup_restrict-height nmap-uploader-polygon-popup',
  contentClassName: 'nk-popup__content nmap-uploader-polygon-popup__content',
  iframeClassName: NOTES_IFRAME_CLASS,
})

export const isNotesPopupOpen = popup.isOpen
export const closeNotesPopup = popup.close
export const toggleNotesPopup = popup.toggle
export const teardownNotesPopup = popup.teardown
