/**
 * Модуль подавления системных сообщений тулбара о лимите вершин в Народной Яндекс.Карте.
 * Реализует превентивное CSS-сокрытие без мерцания и точечное управление DOM-стилями.
 */

export const HIDER_STYLE_ID = 'nmap-system-banner-hider'
export const HIDER_ATTR = 'data-nmap-hide-system-banner'

const HIDER_CSS = `
html[${HIDER_ATTR}="true"] .nk-on-map-toolbar__message,
html[${HIDER_ATTR}="true"] .nk-toolbar__message,
html[${HIDER_ATTR}="true"] .nk-toolbar__message-warning,
html[${HIDER_ATTR}="true"] .nk-toolbar__message-alert,
html[${HIDER_ATTR}="true"] .nk-toolbar__message-error,
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="toolbar__message"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="message_theme_warning"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="message_theme_alert"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="message_theme_error"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="message_theme_danger"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="message"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="warning"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="alert"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="error"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="notice"],
html[${HIDER_ATTR}="true"] [class*="on-map-toolbar"] [class*="popup"],
html[${HIDER_ATTR}="true"] .nk-message_theme_warning,
html[${HIDER_ATTR}="true"] .nk-message_theme_alert,
html[${HIDER_ATTR}="true"] .nk-message_theme_error,
html[${HIDER_ATTR}="true"] [class*="popup"] [class*="message_theme_warning"],
html[${HIDER_ATTR}="true"] [class*="popup"] [class*="message_theme_alert"],
html[${HIDER_ATTR}="true"] [class*="popup"] [class*="message_theme_error"],
html[${HIDER_ATTR}="true"] [class*="popup"] [class*="warning"],
html[${HIDER_ATTR}="true"] [class*="popup"] [class*="alert"],
html[${HIDER_ATTR}="true"] [class*="popup"] [class*="error"],
html[${HIDER_ATTR}="true"] [class*="notification"] [class*="message_theme_warning"],
html[${HIDER_ATTR}="true"] [class*="notification"] [class*="message_theme_alert"],
html[${HIDER_ATTR}="true"] [class*="notification"] [class*="message_theme_error"],
html[${HIDER_ATTR}="true"] [class*="notification"][class*="warning"],
html[${HIDER_ATTR}="true"] [class*="notification"][class*="alert"],
html[${HIDER_ATTR}="true"] [class*="notification"][class*="error"] {
  display: none !important;
}
`

const hiddenSystemElements = new Set<HTMLElement>()

/**
 * Находит безопасный контейнер сообщения (плашку), не затрагивая сам тулбар с кнопками.
 */
export const getSystemBannerContainer = (el: Element): HTMLElement | null => {
  if (
    el.querySelector('button, .nk-button, [role="button"]') ||
    el.className.includes('toolbar-view')
  ) {
    const innerMessage = el.querySelector<HTMLElement>(
      '[class*="toolbar__message"], [class*="message"], [class*="warning"], [class*="alert"], [class*="error"], [class*="notice"]',
    )
    if (innerMessage) return innerMessage
    return null
  }

  const messageContainer = el.closest<HTMLElement>(
    '[class*="toolbar__message"], [class*="notification"], [class*="toast"], [class*="popup"] [class*="message"], [class*="message_theme_warning"], [class*="message_theme_alert"], [class*="message_theme_error"], [class*="message"]',
  )
  if (messageContainer) return messageContainer

  if (!el.querySelector('button, [role="button"]') && !el.className.includes('on-map-toolbar')) {
    return el as HTMLElement
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
    const existingStyle = document.getElementById(HIDER_STYLE_ID)
    if (!existingStyle) {
      const style = document.createElement('style')
      style.id = HIDER_STYLE_ID
      style.textContent = HIDER_CSS
      const target = document.head || document.documentElement
      target?.appendChild(style)
    }
  } else {
    document.documentElement.removeAttribute(HIDER_ATTR)
    const existingStyle = document.getElementById(HIDER_STYLE_ID)
    if (existingStyle) {
      existingStyle.remove()
    }
    restoreSystemBanners()
  }
}
