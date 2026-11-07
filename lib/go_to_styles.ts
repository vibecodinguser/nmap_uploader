import { ensureInjectedStyle } from '@/lib/injected_styles'
import { GO_TO_STYLES, GO_TO_STYLES_ID } from './go_to/styles_css'

export * from './go_to/styles_css'

/** Подключает изолированные стили go-to UI, без классов nk-popup/nk-map-region-view. */
export const ensureGoToStyles = (): void => {
  ensureInjectedStyle(GO_TO_STYLES_ID, GO_TO_STYLES)
}
