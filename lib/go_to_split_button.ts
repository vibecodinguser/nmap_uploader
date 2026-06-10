import { browser } from 'wxt/browser'
import { GO_TO_BUTTON_HIDDEN_CLASS } from '@/lib/go_to_styles'
import { parseStaticSvg } from '@/lib/parse_static_svg'

export const GO_TO_SPLIT_BUTTON_ID = 'goToSplitButton'
export const GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY = 'go_to_split_button_enabled'
export const GO_TO_SPLIT_BUTTON_HIDDEN_CLASS = GO_TO_BUTTON_HIDDEN_CLASS

export const GO_TO_SPLIT_BUTTON_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" fill="none" aria-hidden="true"><rect x="12" y="15" width="30" height="60" rx="4" stroke="currentColor" stroke-width="5"/><rect x="48" y="15" width="30" height="60" rx="4" stroke="currentColor" stroke-width="5"/></svg>`

const GO_TO_SPLIT_BUTTON_CLASS =
  'nmap-uploader-goto-btn nmap-uploader-split-btn nk-button nk-button_type_link nk-button_theme_air nk-button_size_xl nk-button_view_dark nk-map-region-view__button nk-map-region-view__button_id_goto'

const createSplitIconHost = (): HTMLSpanElement => {
  const iconHost = document.createElement('span')
  iconHost.className = 'nk-icon nk-icon_align_auto nmap-uploader-goto-icon'
  iconHost.appendChild(parseStaticSvg(GO_TO_SPLIT_BUTTON_ICON_SVG))
  return iconHost
}

/** Создаёт кнопку раздельного вида без insertAdjacentHTML. */
export const createSplitViewButton = (): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = GO_TO_SPLIT_BUTTON_ID
  button.setAttribute('aria-pressed', 'false')
  button.setAttribute('aria-label', 'Раздельный вид')
  button.className = GO_TO_SPLIT_BUTTON_CLASS
  button.appendChild(createSplitIconHost())
  return button
}

export const getStoredSplitButtonEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY)
  const value = stored[GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]
  return value === undefined ? true : Boolean(value)
}

export const setStoredSplitButtonEnabled = async (enabled: boolean): Promise<void> => {
  await browser.storage.local.set({ [GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]: enabled })
}
