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
  if (typeof document === 'undefined') {
    return
  }
  if (document.getElementById(TRACKER_STYLES_ID)) {
    return
  }
  const style = document.createElement('style')
  style.id = TRACKER_STYLES_ID
  style.textContent = TRACKER_STYLES
  document.head.appendChild(style)
}

/** Удаляет стили панели. */
export const removeTrackerStyles = (): void => {
  document.getElementById(TRACKER_STYLES_ID)?.remove()
}
