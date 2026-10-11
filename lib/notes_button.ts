import { browser } from 'wxt/browser'
import { parseStaticSvg } from '@/lib/parse_static_svg'

export const NOTES_BUTTON_ID = 'notesButton'
export const NOTES_BUTTON_ENABLED_STORAGE_KEY = 'notes_button_enabled'
export const NOTES_BUTTON_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2"/><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

const NOTES_BUTTON_CLASS =
  'nmap-uploader-goto-btn nmap-uploader-notes-btn nk-button nk-button_type_link nk-button_theme_air nk-button_size_xl nk-button_view_dark nk-map-region-view__button nk-map-region-view__button_id_goto'

export const createNotesButton = (ariaLabel = ''): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = NOTES_BUTTON_ID
  button.setAttribute('aria-expanded', 'false')
  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel)
  }
  button.className = NOTES_BUTTON_CLASS

  const iconHost = document.createElement('span')
  iconHost.className = 'nk-icon nk-icon_align_auto nmap-uploader-goto-icon'
  iconHost.appendChild(parseStaticSvg(NOTES_BUTTON_ICON_SVG))
  button.appendChild(iconHost)
  return button
}

export const getStoredNotesButtonEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(NOTES_BUTTON_ENABLED_STORAGE_KEY)
  const value = stored[NOTES_BUTTON_ENABLED_STORAGE_KEY]
  return value === undefined ? true : Boolean(value)
}

export const setStoredNotesButtonEnabled = async (enabled: boolean): Promise<void> => {
  await browser.storage.local.set({ [NOTES_BUTTON_ENABLED_STORAGE_KEY]: enabled })
}
