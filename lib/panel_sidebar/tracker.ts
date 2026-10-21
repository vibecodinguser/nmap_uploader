import { PANEL_SIDEBAR_WRAPPER_ID } from '@/lib/panel_sidebar_notify'

/**
 * Ищет дату трекера в кнопках интерфейса и уведомляет слушателей при изменении.
 */
export const checkAndNotifyTrackerDate = ({
  lastDate,
  onDateChange,
}: {
  lastDate: string
  onDateChange: (newDate: string) => void
}): string => {
  if (typeof document === 'undefined') return lastDate

  const btns = document.querySelectorAll('.nk-button__text')
  for (const btn of btns) {
    const txt = btn.textContent?.trim() || ''
    if (/\d{2}\.\d{2}\.\d{4}/.test(txt)) {
      if (txt !== lastDate) {
        onDateChange(txt)
        return txt
      }
      break
    }
  }
  return lastDate
}

/**
 * Отправляет сообщение в iframe сайдбара с датой трекера.
 */
export const sendTrackerDateToIframe = (date: string, origin: string): void => {
  if (typeof document === 'undefined') return
  const panelIframe = document.querySelector(
    `#${PANEL_SIDEBAR_WRAPPER_ID} iframe`,
  ) as HTMLIFrameElement | null
  if (panelIframe?.contentWindow) {
    panelIframe.contentWindow.postMessage({ action: 'TRACKER_DATE_CHANGED', date }, origin)
  }
}

/**
 * Управляет выбором даты трекера через клик по выпадающему списку nk-select.
 */
export const setTrackerDateInDom = (
  nkDate: string,
  onComplete?: () => void,
): ReturnType<typeof setInterval> | null => {
  if (typeof document === 'undefined') return null

  const targetContainer = document.querySelector(
    '.nk-select.nk-select_theme_islands.nk-select_size_m',
  )
  if (!targetContainer) return null

  const button = targetContainer.querySelector(
    'button.nk-select__button',
  ) as HTMLButtonElement | null
  if (!button) return null

  const currentText = button.textContent || ''
  if (currentText.includes(nkDate)) return null

  button.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: globalThis as unknown as Window,
    }),
  )
  button.dispatchEvent(
    new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: globalThis as unknown as Window,
    }),
  )
  button.click()

  let attempts = 0
  const checkInterval = setInterval(() => {
    attempts++
    const menuItems = document.querySelectorAll(
      '.nk-popup .nk-menu__item, [class*="popup_visible"] [class*="menu-item"]',
    )

    if (menuItems.length > 0) {
      clearInterval(checkInterval)

      let found = false
      for (const item of Array.from(menuItems)) {
        const itemText = item.textContent || ''
        if (itemText.includes(nkDate)) {
          ;(item as HTMLElement).click()
          found = true
          break
        }
      }

      if (!found) {
        button.click()
      }
      onComplete?.()
    } else if (attempts > 10) {
      clearInterval(checkInterval)
      onComplete?.()
    }
  }, 100)

  return checkInterval
}
