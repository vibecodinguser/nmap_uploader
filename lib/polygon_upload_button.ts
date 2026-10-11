import { parseStaticSvg } from '@/lib/parse_static_svg'

export const POLYGON_UPLOAD_BUTTON_ID = 'polygonUploadButton'
export const POLYGON_UPLOAD_BUTTON_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m0-12-4 4m4-4 4 4M5 14v5h14v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const POLYGON_UPLOAD_BUTTON_CLASS =
  'nmap-uploader-goto-btn nmap-uploader-polygon-upload-btn nk-button nk-button_type_link nk-button_theme_air nk-button_size_xl nk-button_view_dark nk-map-region-view__button nk-map-region-view__button_id_goto'

export const createPolygonUploadButton = (ariaLabel = ''): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = POLYGON_UPLOAD_BUTTON_ID
  button.setAttribute('aria-expanded', 'false')
  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel)
  }
  button.className = POLYGON_UPLOAD_BUTTON_CLASS

  const iconHost = document.createElement('span')
  iconHost.className = 'nk-icon nk-icon_align_auto nmap-uploader-goto-icon'
  iconHost.appendChild(parseStaticSvg(POLYGON_UPLOAD_BUTTON_ICON_SVG))
  button.appendChild(iconHost)
  return button
}
