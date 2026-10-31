/**
 * Утилиты поиска и парсинга системного баннера предупреждения о лимите вершин в Народной Яндекс.Карте:
 * "Лимит — 500 вершин. Можно нарисовать ещё 11 вершин" / "Limit — 500 vertices. You can draw 11 more vertices"
 */

/**
 * Извлекает оставшееся количество вершин из текста системного предупреждения.
 */
export const parseSystemLimitText = (text: string | null | undefined): number | null => {
  if (!text) return null
  const cleanText = text.replace(/\s+/g, ' ').trim()

  // 1. Проверка на превышение лимита (возвращает отрицательное число как индикатор превышения)
  const ruExceededMatch = cleanText.match(/лимит\s*превышен\s*(?:на)?\s*(\d+)\s*вершин/i)
  if (ruExceededMatch) {
    return -Number.parseInt(ruExceededMatch[1], 10)
  }

  const enExceededMatch = cleanText.match(
    /limit\s*exceeded\s*(?:by)?\s*(\d+)\s*(?:vertex|vertices|vertic)/i,
  )
  if (enExceededMatch) {
    return -Number.parseInt(enExceededMatch[1], 10)
  }

  // 2. Проверка на исчерпание лимита (0 вершин)
  if (
    /лимит\s*(?:достигнут|исчерпан)/i.test(cleanText) ||
    /(?:достигнут|исчерпан)\s*лимит/i.test(cleanText) ||
    /нельзя\s*нарисовать\s*больше/i.test(cleanText) ||
    /больше\s*нельзя\s*(?:добавить|нарисовать)/i.test(cleanText) ||
    /максимум\s*вершин/i.test(cleanText) ||
    /максимальное\s*количество\s*вершин/i.test(cleanText) ||
    /limit\s*reached/i.test(cleanText) ||
    /no\s*more\s*vertices/i.test(cleanText) ||
    /maximum\s*(?:number\s*of\s*)?vertices/i.test(cleanText)
  ) {
    return 0
  }

  // 3. Русский паттерн: "Лимит — 500 вершин. Можно нарисовать ещё 11 вершин"
  // или "Можно нарисовать ещё 1 вершину", "Осталось ещё 4 вершины"
  const ruMatch = cleanText.match(
    /(?:можно нарисовать ещё|осталось ещё|ещё|осталось)\s*(\d+)\s*вершин/i,
  )
  if (ruMatch) {
    return Number.parseInt(ruMatch[1], 10)
  }

  // 4. Английский паттерн: "You can draw 11 more vertices" или "1 more vertex"
  const enMatch = cleanText.match(/(\d+)\s*more\s*(?:vertex|vertices|vertic)/i)
  if (enMatch) {
    return Number.parseInt(enMatch[1], 10)
  }

  return null
}

const TARGETED_BANNER_SELECTORS = [
  '[class*="toolbar__message"]',
  '[class*="on-map-toolbar"] [class*="message"]',
  '[class*="on-map-toolbar"] [class*="warning"]',
  '[class*="on-map-toolbar"] [class*="alert"]',
  '[class*="on-map-toolbar"] [class*="error"]',
  '[class*="on-map-toolbar"] [class*="notice"]',
  '[class*="toolbar"] [class*="message"]',
  '[class*="toolbar"] [class*="warning"]',
  '[class*="toolbar"] [class*="alert"]',
  '[class*="toolbar"] [class*="error"]',
  '[class*="toolbar"] [class*="notice"]',
  '[class*="toolbar"] [class*="hint"]',
  '[class*="message_theme_warning"]',
  '[class*="message_theme_alert"]',
  '[class*="message_theme_error"]',
  '[class*="message_theme_danger"]',
  '[class*="popup"] [class*="message"]',
  '[class*="popup"] [class*="content"]',
  '[class*="notification"]',
  '[class*="toast"]',
].join(', ')

let lastCheckTime = 0
let cachedRemaining: number | null = null
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
      '[class*="toolbar__message"], [class*="message"], [class*="warning"], [class*="alert"], [class*="notice"]',
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
 * Проверяет, активен ли режим редактирования геометрии на карте (наличие видимого тулбара).
 */
export const isGeometryEditorActive = (
  root: ParentNode = typeof document !== 'undefined' ? document : ({} as ParentNode),
): boolean => {
  if (!root || typeof root.querySelector !== 'function') return false

  const hasMapContainer = Boolean(
    root.querySelector('ymaps, [class*="map"], .nk-map, .nk-sidebar-view'),
  )
  if (!hasMapContainer) {
    // В тестах или вне страницы карты проверка не блокирует поиск
    return true
  }

  const toolbar = root.querySelector(
    '[class*="on-map-toolbar"], .nk-on-map-toolbar, [class*="geometry-editor"]',
  )
  if (!toolbar) return false

  if (toolbar instanceof HTMLElement) {
    if (
      toolbar.style.display === 'none' ||
      toolbar.classList.contains('is-hidden') ||
      toolbar.getAttribute('aria-hidden') === 'true'
    ) {
      return false
    }
  }

  return true
}

/**
 * Проверяет, не скрыт ли системный баннер Яндексом (через БЭМ-модификаторы или атрибуты).
 */
export const isBannerElementActive = (el: Element): boolean => {
  if (!el?.isConnected) return false

  const hiddenAncestor = el.closest(
    '.is-hidden, [class*="_hidden"], [class*="--hidden"], [aria-hidden="true"], [hidden]',
  )
  if (hiddenAncestor && !hiddenAncestor.hasAttribute('data-nmap-hidden-system-banner')) {
    return false
  }

  let curr: Element | null = el
  while (curr && curr !== document.body) {
    if (curr instanceof HTMLElement && !curr.hasAttribute('data-nmap-hidden-system-banner')) {
      if (curr.style.display === 'none' || curr.style.visibility === 'hidden') {
        return false
      }
    }
    curr = curr.parentElement
  }

  return true
}

/**
 * Ищет в DOM системный баннер/сообщение о лимите вершин и возвращает остаток, если он найден.
 * Выполняет только узконаправленный поиск по специализированным блокам подсказок тулбара.
 * Если shouldHide = true, скрывает найденное системное сообщение.
 */
export const findSystemRemainingVertices = (
  root: ParentNode = typeof document !== 'undefined' ? document : ({} as ParentNode),
  shouldHide = false,
): number | null => {
  if (!root || typeof root.querySelectorAll !== 'function') return null
  if (!isGeometryEditorActive(root)) return null

  const targetedElements = root.querySelectorAll(TARGETED_BANNER_SELECTORS)

  for (const el of targetedElements) {
    if (el.id === 'nmap-point-counter-wrapper' || el.closest?.('#nmap-point-counter-wrapper')) {
      continue
    }

    if (!isBannerElementActive(el)) {
      continue
    }

    const text = el.textContent
    const lowerText = text?.toLowerCase() || ''
    const isLimitRelated =
      lowerText.includes('вершин') ||
      lowerText.includes('vertic') ||
      lowerText.includes('лимит') ||
      lowerText.includes('limit')

    if (isLimitRelated) {
      const remaining = parseSystemLimitText(text)
      if (remaining !== null) {
        if (shouldHide) {
          hideSystemBannerElement(el)
        }
        return remaining
      }
    }
  }

  return null
}

/**
 * Троттлированная версия поиска системного баннера (не чаще 1 раза в 200мс),
 * предотвращающая блокировку основного потока браузера при частых мутациях.
 */
export const getThrottledSystemRemainingVertices = (
  root?: ParentNode,
  force = false,
  shouldHide = false,
): number | null => {
  const now = Date.now()
  if (!force && now - lastCheckTime < 50) {
    return cachedRemaining
  }
  lastCheckTime = now
  cachedRemaining = findSystemRemainingVertices(root, shouldHide)
  return cachedRemaining
}

export const resetSystemRemainingCache = (): void => {
  lastCheckTime = 0
  cachedRemaining = null
}
