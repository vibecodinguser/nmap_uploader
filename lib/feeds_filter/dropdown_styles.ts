import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import { FEEDS_FILTER_STYLES_ID } from './constants'
import { FEED_CARD_HIDDEN_STYLES, FEED_POPUP_MENU_STYLES } from './dropdown_popup_styles'
import selectCss from './feeds_select.css?inline'

export * from './dropdown_popup_styles'

export const FEED_SELECT_BUTTON_STYLES = selectCss

/**
 * Подключает изолированные CSS-стили для дропдауна фильтра и скрытия карточек.
 */
export const ensureFeedFilterStyles = (): void => {
  ensureInjectedStyle(
    FEEDS_FILTER_STYLES_ID,
    [FEED_CARD_HIDDEN_STYLES, FEED_SELECT_BUTTON_STYLES, FEED_POPUP_MENU_STYLES].join('\n'),
  )
}

/** Удаляет стили фильтров ленты. */
export const removeFeedFilterStyles = (): void => {
  removeInjectedStyle(FEEDS_FILTER_STYLES_ID)
}
