import { GO_TO_BUTTON_HIDDEN_CLASS } from '@/lib/go_to_styles'

export const GO_TO_SPLIT_BUTTON_ID = 'goToSplitButton'
export const GO_TO_SPLIT_BUTTON_HIDDEN_CLASS = GO_TO_BUTTON_HIDDEN_CLASS

const SPLIT_BUTTON_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" fill="none" aria-hidden="true"><rect x="12" y="15" width="30" height="60" rx="4" stroke="currentColor" stroke-width="5"/><rect x="48" y="15" width="30" height="60" rx="4" stroke="currentColor" stroke-width="5"/></svg>`

export const buildSplitViewButtonHtml = (): string =>
  `<button type="button" id="${GO_TO_SPLIT_BUTTON_ID}" aria-pressed="false" aria-label="Раздельный вид" class="nmap-uploader-goto-btn nmap-uploader-split-btn nk-button nk-button_type_link nk-button_theme_air nk-button_size_xl nk-button_view_dark nk-map-region-view__button nk-map-region-view__button_id_goto"><span class="nk-icon nk-icon_align_auto nmap-uploader-goto-icon">${SPLIT_BUTTON_ICON_SVG}</span></button>`
