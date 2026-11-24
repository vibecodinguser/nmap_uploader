import { GO_TO_SPLIT_STYLES } from './split_styles_css'
import goToCss from './styles.css?inline'

export * from './split_styles_css'

export const GO_TO_STYLES_ID = 'yamapper-go-to-styles'

export const GO_TO_BUTTON_HIDDEN_CLASS = 'yamapper-goto-btn--hidden'
export const GO_TO_POPUP_VISIBLE_CLASS = 'yamapper-popup--visible'
export const GO_TO_MENU_ITEM_HOVERED_CLASS = 'yamapper-menu__item--hovered'
export const GO_TO_BUTTON_HOVERED_CLASS = 'yamapper-goto-btn--hovered'

export const GO_TO_STYLES = [goToCss, GO_TO_SPLIT_STYLES].join('\n')
