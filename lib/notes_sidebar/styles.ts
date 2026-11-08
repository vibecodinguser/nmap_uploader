import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import { NOTES_STYLES_ID } from './core'
import notesSidebarCss from './styles.css?inline'

/** Стили блока создания заметки в сайдбаре. */
export const NOTES_SIDEBAR_STYLES = notesSidebarCss

export const ensureNotesSidebarStyles = (): void => {
  ensureInjectedStyle(NOTES_STYLES_ID, NOTES_SIDEBAR_STYLES)
}

export const removeNotesSidebarStyles = (): void => {
  removeInjectedStyle(NOTES_STYLES_ID)
}
