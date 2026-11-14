/**
 * События панели заметок в DOM страницы карты.
 *
 * Кнопка заметок живёт в контент-скрипте тулбара, а панель — в своём
 * контент-скрипте. Мир у них общий, поэтому сигнал передаётся событием
 * документа, а не сообщением рантайма.
 */
export const NMAPS_TOGGLE_NOTES_PANEL_EVENT = 'nmap-uploader-toggle-notes-panel'

export const notifyToggleNotesPanel = (): void => {
  document.dispatchEvent(new CustomEvent(NMAPS_TOGGLE_NOTES_PANEL_EVENT, { bubbles: true }))
}
