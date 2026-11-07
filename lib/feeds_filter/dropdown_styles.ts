import { FEEDS_FILTER_STYLES_ID } from './constants'
import { FEED_CARD_HIDDEN_STYLES, FEED_POPUP_MENU_STYLES } from './dropdown_popup_styles'
import selectCss from './feeds_select.css?inline'

export * from './dropdown_popup_styles'

export const FEED_SELECT_BUTTON_STYLES = selectCss

/**
 * Подключает изолированные CSS-стили для дропдауна фильтра и скрытия карточек.
 */
export const ensureFeedFilterStyles = (): void => {
  if (document.getElementById(FEEDS_FILTER_STYLES_ID)) {
    return
  }

  const styleEl = document.createElement('style')
  styleEl.id = FEEDS_FILTER_STYLES_ID
  styleEl.textContent = `
    ${FEED_CARD_HIDDEN_STYLES}
    ${FEED_SELECT_BUTTON_STYLES}
    ${FEED_POPUP_MENU_STYLES}
  `
  document.head.appendChild(styleEl)
}
