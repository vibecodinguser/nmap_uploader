/** Событие смены URL редактора НЯК (MAIN world → isolated). */
export const NMAPS_URL_CHANGE_EVENT = 'yamapper-nmaps-url-change' as const

export const notifyNmapsUrlChange = (): void => {
  document.dispatchEvent(new CustomEvent(NMAPS_URL_CHANGE_EVENT, { bubbles: true }))
}
