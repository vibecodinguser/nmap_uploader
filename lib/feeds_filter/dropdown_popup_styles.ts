import { FEED_HIDDEN_CLASS } from './constants'
import popupCss from './feeds_popup.css?inline'

export const FEED_POPUP_MENU_STYLES = popupCss

export const FEED_CARD_HIDDEN_STYLES = `
    .${FEED_HIDDEN_CLASS} {
      display: none !important;
    }
`
