/**
 * Общие имена попапа настроек.
 *
 * Модуль без зависимостей: его читают background, content script во вкладке
 * редактора и панель расширения внутри iframe.
 */
import type { MessageKey } from '@/lib/i18n/types'

/** Узел попапа в DOM хоста. */
export const SETTINGS_POPUP_ID = 'yamapper-settings-popup'
/** Стиль попапа; отдельно от id узла, иначе поиск попапа находит `<style>`. */
export const SETTINGS_POPUP_STYLES_ID = 'yamapper-settings-popup-styles'
/** Кнопка в шапке редактора (`.nk-app-bar-view`). */
export const SETTINGS_BUTTON_ID = 'yamapperSettingsButton'
/** Подпись кнопки: та же, что у заголовка настроек. */
export const SETTINGS_BUTTON_ICON_REF: MessageKey = 'settings.openAria'
/** Название попапа для скринридеров. */
export const SETTINGS_POPUP_TITLE_REF: MessageKey = 'settings.title'

/** Сообщение background → вкладка редактора: переключить попап. */
export const TOGGLE_SETTINGS_POPUP_ACTION = 'toggleSettingsPopup' as const
/** Сообщение панели → хост попапа: закрыть. */
export const CLOSE_SETTINGS_POPUP_ACTION = 'closeSettingsPopup' as const
/** Сообщение панели → хост попапа: подогнать высоту под содержимое. */
export const SETTINGS_POPUP_FIT_HEIGHT_MESSAGE = 'SETTINGS_POPUP_FIT_HEIGHT' as const
