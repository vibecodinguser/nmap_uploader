import { GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'
import { createMapIframePopup } from '@/lib/map_iframe_popup'

export const POLYGON_UPLOAD_POPUP_ID = 'nmapUploaderPolygonUploadPopup'
const POLYGON_UPLOAD_IFRAME_CLASS = 'yamapper-polygon-popup__iframe'

const popup = createMapIframePopup({
  popupId: POLYGON_UPLOAD_POPUP_ID,
  pagePath: '/polygon-upload.html',
  popupClassName: `yamapper-popup ${GO_TO_POPUP_VISIBLE_CLASS} yamapper-polygon-popup`,
  contentClassName: 'yamapper-polygon-popup__content',
  iframeClassName: POLYGON_UPLOAD_IFRAME_CLASS,
})

export const isPolygonUploadPopupOpen = popup.isOpen
export const closePolygonUploadPopup = popup.close
export const togglePolygonUploadPopup = popup.toggle
export const teardownPolygonUploadPopup = popup.teardown
