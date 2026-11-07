/**
 * Модуль подавления системных сообщений тулбара о лимите вершин в Народной Яндекс.Карте.
 * Реализует превентивное CSS-сокрытие без мерцания и точечное управление DOM-стилями,
 * не затрагивая глобальные системные уведомления (права доступа, ошибки сохранения и т.д.).
 */

import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import hiderCss from './banner_suppressor.css?inline'

export const HIDER_STYLE_ID = 'nmap-system-banner-hider'
export const HIDER_ATTR = 'data-nmap-hide-system-banner'

/** Инжектируемый CSS: источник — `banner_suppressor.css`. */
export const HIDER_CSS = hiderCss

const hiddenSystemElements = new Set<HTMLElement>()

const isLimitRelatedBannerText = (text: string | null | undefined): boolean => {
  if (!text) return false
  const lower = text.toLowerCase()
  return (
    lower.includes('вершин') ||
    lower.includes('vertic') ||
    lower.includes('лимит') ||
    lower.includes('limit')
  )
}

/**
 * Находит безопасный контейнер сообщения (плашку), не затрагивая сам тулбар с кнопками
 * и не затрагивая глобальные нотификации страницы, не относящиеся к лимиту вершин.
 */
export const getSystemBannerContainer = (el: Element): HTMLElement | null => {
  const notificationAncestor = el.closest<HTMLElement>(
    '.nk-notification, [class*="notification"], [class*="toast"]',
  )
  if (notificationAncestor) {
    if (
      isLimitRelatedBannerText(notificationAncestor.textContent) &&
      !notificationAncestor.querySelector('button, .nk-button, [role="button"]')
    ) {
      return notificationAncestor
    }
    return null
  }

  // 1. Если сам el является элементом/блоком сообщения тулбара и не содержит кнопок
  const isMessageSelf =
    !el.querySelector('button, .nk-button, [role="button"]') &&
    (el.className.includes('__message') ||
      el.className.includes('message_theme_') ||
      el.className.includes('toolbar__message'))

  if (isMessageSelf) {
    return el as HTMLElement
  }

  // 2. Если передан контейнер тулбара (с кнопками или основной класс тулбара), ищем сообщение внутри него
  if (
    el.querySelector('button, .nk-button, [role="button"]') ||
    el.classList.contains('nk-on-map-toolbar') ||
    el.classList.contains('nk-toolbar-view')
  ) {
    const innerMessage = el.querySelector<HTMLElement>(
      '[class*="toolbar__message"], [class*="message"], [class*="warning"], [class*="alert"], [class*="error"], [class*="notice"]',
    )
    if (innerMessage && !innerMessage.querySelector('button, [role="button"]')) {
      return innerMessage
    }
    return null
  }

  // 3. Ищем ближайший контейнер сообщения вверх по DOM, не захватывая тулбар с кнопками
  const messageContainer = el.closest<HTMLElement>(
    [
      '[class*="toolbar__message"]',
      '[class*="on-map-toolbar"] [class*="message"]',
      '[class*="message_theme_warning"]',
      '[class*="message_theme_alert"]',
      '[class*="popup"] [class*="message"]',
      '[class*="popup"] [class*="content"]',
      '[class*="tooltip"] [class*="content"]',
      '[class*="tooltip"]',
      '.nk-on-map-toolbar__message',
      '.nk-toolbar__message',
      '.nk-toolbar__message-warning',
      '.nk-toolbar__message-alert',
    ].join(', '),
  )
  if (messageContainer && !messageContainer.querySelector('button, [role="button"]')) {
    return messageContainer
  }

  // 4. Если сам элемент не содержит кнопок и похож на плашку сообщения или содержит текст о лимите
  if (
    !el.querySelector('button, [role="button"], canvas') &&
    !el.classList.contains('nk-on-map-toolbar') &&
    (el.className.includes('toolbar__message') ||
      el.className.includes('message') ||
      el.className.includes('warning') ||
      el.className.includes('alert') ||
      isLimitRelatedBannerText(el.textContent) ||
      Boolean(el.closest('[class*="on-map-toolbar"], .nk-on-map-toolbar, [class*="toolbar"]')))
  ) {
    let target = el as HTMLElement
    const trimmedText = (el.textContent || '').trim()
    if (trimmedText) {
      while (
        target.parentElement &&
        target.parentElement !== document.body &&
        target.parentElement !== document.documentElement &&
        (target.parentElement.textContent || '').trim() === trimmedText &&
        !target.parentElement.querySelector('button, [role="button"], canvas') &&
        !target.parentElement.classList.contains('nk-on-map-toolbar') &&
        !target.parentElement.classList.contains('nk-toolbar-view')
      ) {
        target = target.parentElement
      }
    }
    return target
  }

  return null
}

/**
 * Скрывает системное сообщение о лимите вершин, чтобы избежать визуального дублирования со счетчиком.
 */
export const hideSystemBannerElement = (el: Element): void => {
  const container = getSystemBannerContainer(el)
  if (!container?.style) return

  if (container.style.display !== 'none') {
    container.style.setProperty('display', 'none', 'important')
    container.setAttribute('data-nmap-hidden-system-banner', 'true')
    hiddenSystemElements.add(container)
  }
}

/**
 * Восстанавливает видимость системных сообщений (например, при отключении счетчика в настройках).
 */
export const restoreSystemBanners = (
  root: ParentNode = typeof document !== 'undefined' ? document : ({} as ParentNode),
): void => {
  for (const el of hiddenSystemElements) {
    el.style.removeProperty('display')
    el.removeAttribute('data-nmap-hidden-system-banner')
  }
  hiddenSystemElements.clear()

  if (root && typeof root.querySelectorAll === 'function') {
    const remainingHidden = root.querySelectorAll('[data-nmap-hidden-system-banner="true"]')
    for (const el of remainingHidden) {
      if (el instanceof HTMLElement) {
        el.style.removeProperty('display')
        el.removeAttribute('data-nmap-hidden-system-banner')
      }
    }
  }
}

/**
 * Управляет мгновенным подавлением системного баннера на уровне CSS,
 * исключая мерцание/мигание оранжевой плашки перед скрытием через JS.
 */
export const setSystemBannerSuppressed = (suppressed: boolean): void => {
  if (typeof document === 'undefined') return

  if (suppressed) {
    document.documentElement.setAttribute(HIDER_ATTR, 'true')
    ensureInjectedStyle(HIDER_STYLE_ID, HIDER_CSS)
  } else {
    document.documentElement.removeAttribute(HIDER_ATTR)
    removeInjectedStyle(HIDER_STYLE_ID)
    restoreSystemBanners()
  }
}
