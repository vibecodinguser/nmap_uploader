/**
 * Короткое сообщение об ошибке в стиле панели наблюдения.
 *
 * Пункт меню закрывается вместе с нативным попапом, поэтому показать ошибку
 * рядом с ним нельзя: сообщение живёт поверх страницы и исчезает само.
 */
import { ensureTrackerStyles } from './styles'

export const TRACKER_TOAST_ID = 'yamapper-object-tracker-toast'
const TRACKER_TOAST_CLASS = 'nmap-ot-toast'
export const TRACKER_TOAST_VISIBLE_CLASS = 'nmap-ot-toast_visible'

const TOAST_TIMEOUT_MS = 3000

let hideTimer: ReturnType<typeof setTimeout> | null = null

const clearHideTimer = (): void => {
  if (hideTimer === null) return
  clearTimeout(hideTimer)
  hideTimer = null
}

/** Показывает сообщение и перезапускает таймер автоскрытия. */
export const showTrackerToast = (text: string): void => {
  if (typeof document === 'undefined' || !text) return

  ensureTrackerStyles()

  let toast = document.getElementById(TRACKER_TOAST_ID)
  if (!toast) {
    toast = document.createElement('div')
    toast.id = TRACKER_TOAST_ID
    toast.className = `${TRACKER_TOAST_CLASS} ${TRACKER_TOAST_VISIBLE_CLASS}`
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    document.body.appendChild(toast)
  }

  toast.textContent = text
  toast.classList.add(TRACKER_TOAST_VISIBLE_CLASS)

  clearHideTimer()
  hideTimer = setTimeout(() => {
    hideTimer = null
    toast?.remove()
  }, TOAST_TIMEOUT_MS)
}

/** Убирает сообщение досрочно: при выключении функции. */
export const hideTrackerToast = (): void => {
  clearHideTimer()
  document.getElementById(TRACKER_TOAST_ID)?.remove()
}
