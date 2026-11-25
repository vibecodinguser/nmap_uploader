import { CLOSE_SETTINGS_POPUP_ACTION, SETTINGS_POPUP_ID } from '@/lib/settings_popup/protocol'

/** Узел попапа в DOM хоста; панель внутри iframe его видеть не может. */
const getSettingsPopup = (): HTMLElement | null => document.getElementById(SETTINGS_POPUP_ID)

export const isSettingsPopupMountedInDom = (): boolean => getSettingsPopup() !== null

/** Убирает попап из DOM (работает из любого content script на вкладке НЯК). */
export const removeSettingsPopupFromDom = (): void => {
  getSettingsPopup()?.remove()
}

/**
 * Просит хост закрыть попап.
 *
 * Вызывается из панели настроек внутри iframe: своего DOM хоста у неё нет.
 * Хост слушает это сообщение и убирает узел.
 */
export const requestCloseSettingsPopup = (): void => {
  window.parent?.postMessage({ action: CLOSE_SETTINGS_POPUP_ACTION }, '*')
}
