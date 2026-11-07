import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import { TRACKER_STYLES_ID } from './dom'
import trackerCss from './styles.css?inline'

/**
 * Стили панели наблюдения.
 *
 * Цвета и состояния контролов приходят от нативных классов редактора
 * (`nk-button`, `nk-text-input`), поэтому панель выглядит и ведёт себя как
 * остальные элементы сайдбара, включая тёмную тему. Здесь только раскладка.
 */
export const TRACKER_STYLES = trackerCss

/** Добавляет стили панели на страницу один раз. */
export const ensureTrackerStyles = (): void => {
  ensureInjectedStyle(TRACKER_STYLES_ID, TRACKER_STYLES)
}

/** Удаляет стили панели. */
export const removeTrackerStyles = (): void => {
  removeInjectedStyle(TRACKER_STYLES_ID)
}
