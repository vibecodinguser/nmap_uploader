/**
 * Пакет попапа настроек: кнопка в шапке редактора и сам попап.
 */

export {
  createSettingsButton,
  ensureSettingsButton,
  getSettingsButton,
  repairSettingsButtonIcon,
  resolveSettingsAppBar,
  SETTINGS_APP_BAR_SELECTOR,
  SETTINGS_BUTTON_CLASS,
  type SettingsButtonOptions,
  syncSettingsButtonPressed,
} from './button'
export {
  createSettingsPopupHost,
  ensureSettingsPopupStyles,
  measureSettingsPopupRect,
  SETTINGS_POPUP_WIDTH,
  type SettingsPopupHost,
  type SettingsPopupHostOptions,
  type SettingsPopupRect,
} from './host'
export { SETTINGS_BUTTON_ICON_SVG } from './icon'
export {
  CLOSE_SETTINGS_POPUP_ACTION,
  SETTINGS_BUTTON_ID,
  SETTINGS_POPUP_FIT_HEIGHT_MESSAGE,
  SETTINGS_POPUP_ID,
  SETTINGS_POPUP_STYLES_ID,
  TOGGLE_SETTINGS_POPUP_ACTION,
} from './protocol'
export { SETTINGS_POPUP_STYLES } from './styles'
