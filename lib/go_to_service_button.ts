import { GO_TO_BUTTON_HIDDEN_CLASS } from '@/lib/go_to_styles'

export const GO_TO_SERVICE_BUTTON_ID = 'goToServiceButton'

export const GO_TO_SERVICE_BUTTON_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" fill="none" aria-hidden="true"><circle cx="45" cy="45" r="30" stroke="currentColor" stroke-width="5"/><ellipse cx="45" cy="45" rx="13" ry="30" stroke="currentColor" stroke-width="5"/><path d="M15 45h60" stroke="currentColor" stroke-width="5"/></svg>`

export const buildGoToServiceButtonHtml = (): string =>
  `<a id="${GO_TO_SERVICE_BUTTON_ID}" aria-disabled="false" class="nmap-uploader-goto-btn nk-button nk-button_type_link nk-button_theme_air nk-button_size_xl nk-button_view_dark nk-map-region-view__button nk-map-region-view__button_id_goto"><span class="nk-icon nk-icon_align_auto nmap-uploader-goto-icon">${GO_TO_SERVICE_BUTTON_ICON_SVG}</span></a>`

export { GO_TO_BUTTON_HIDDEN_CLASS }
