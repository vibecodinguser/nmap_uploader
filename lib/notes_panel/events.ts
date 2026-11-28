/**
 * События панели заметок в DOM страницы карты.
 *
 * Кнопка заметок живёт в контент-скрипте тулбара, а панель — в своём
 * контент-скрипте. Мир у них общий, поэтому сигнал передаётся событием
 * документа, а не сообщением рантайма.
 */
export const NMAPS_TOGGLE_NOTES_PANEL_EVENT = 'yamapper-toggle-notes-panel'

/** Подробности события: `open` просит открыть панель, а не переключить. */
export type NotesPanelToggleDetail = { open?: boolean }

export const notifyToggleNotesPanel = (): void => {
  document.dispatchEvent(new CustomEvent(NMAPS_TOGGLE_NOTES_PANEL_EVENT, { bubbles: true }))
}

/**
 * Открыть панель, даже если она уже открыта.
 *
 * Нужно ответу на диалог разрешений: пользователь нажал кнопку заметок и уже
 * подтвердил доступ — закрывать панель в этот момент было бы неожиданно.
 */
export const notifyOpenNotesPanel = (): void => {
  document.dispatchEvent(
    new CustomEvent<NotesPanelToggleDetail>(NMAPS_TOGGLE_NOTES_PANEL_EVENT, {
      bubbles: true,
      detail: { open: true },
    }),
  )
}
