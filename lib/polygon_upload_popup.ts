import { createMapIframePopup } from '@/lib/map_iframe_popup'

export const POLYGON_UPLOAD_POPUP_ID = 'polygonUploadPopup'
export const POLYGON_UPLOAD_IFRAME_CLASS = 'nmap-uploader-polygon-popup__iframe'

const popup = createMapIframePopup({
  popupId: POLYGON_UPLOAD_POPUP_ID,
  pagePath: '/polygon-upload.html',
  popupClassName:
    'nk-popup nk-popup_visible nk-popup_direction_right-bottom nk-popup_theme_islands nk-popup_restrict-height nmap-uploader-polygon-popup',
  contentClassName: 'nk-popup__content nmap-uploader-polygon-popup__content',
  iframeClassName: POLYGON_UPLOAD_IFRAME_CLASS,
})

export const isPolygonUploadPopupOpen = popup.isOpen
export const closePolygonUploadPopup = popup.close
export const togglePolygonUploadPopup = popup.toggle
export const teardownPolygonUploadPopup = popup.teardown
