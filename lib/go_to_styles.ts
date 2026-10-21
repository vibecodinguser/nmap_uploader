import { GO_TO_STYLES, GO_TO_STYLES_ID } from './go_to/styles_css'

export * from './go_to/styles_css'

/** Подключает изолированные стили go-to UI, без классов nk-popup/nk-map-region-view. */
export const ensureGoToStyles = (): void => {
  const existing = document.getElementById(GO_TO_STYLES_ID)
  if (existing) {
    if (existing.textContent !== GO_TO_STYLES) {
      existing.textContent = GO_TO_STYLES
    }
    return
  }

  const style = document.createElement('style')
  style.id = GO_TO_STYLES_ID
  style.textContent = GO_TO_STYLES
  ;(document.head ?? document.documentElement).appendChild(style)
}
