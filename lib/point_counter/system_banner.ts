/**
 * Утилиты поиска и парсинга системного баннера предупреждения о лимите вершин в Народной Яндекс.Карте:
 * "Лимит — 500 вершин. Можно нарисовать ещё 11 вершин" / "Limit — 500 vertices. You can draw 11 more vertices"
 */

import {
  getSystemBannerContainer,
  HIDER_ATTR,
  HIDER_STYLE_ID,
  hideSystemBannerElement,
  restoreSystemBanners,
  setSystemBannerSuppressed,
} from './banner_suppressor'

export {
  getSystemBannerContainer,
  HIDER_ATTR,
  HIDER_STYLE_ID,
  hideSystemBannerElement,
  restoreSystemBanners,
  setSystemBannerSuppressed,
}

/**
 * Извлекает оставшееся количество вершин из текста системного предупреждения.
 */
export const parseSystemLimitText = (text: string | null | undefined): number | null => {
  if (!text) return null
  const cleanText = text
    .replace(/[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, ' ')
    .trim()

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

  // 3. Прямой шаблон из фразы лимита: "Лимит — 500 вершин. Можно нарисовать ещё 3 вершины" (или "еще 4 вершины")
  const ruLimitPatternMatch = cleanText.match(/лимит\s*[—–:-]?\s*\d+\s*вершин.*?(\d+)\s*вершин/i)
  if (ruLimitPatternMatch) {
    return Number.parseInt(ruLimitPatternMatch[1], 10)
  }

  const enLimitPatternMatch = cleanText.match(
    /limit\s*[—–:-]?\s*\d+\s*(?:vertex|vertices|vertic).*?(\d+)\s*(?:more\s*)?(?:vertex|vertices|vertic)/i,
  )
  if (enLimitPatternMatch) {
    return Number.parseInt(enLimitPatternMatch[1], 10)
  }

  // 4. Русский шаблон с поддержкой "е" и "ё", а также разных предлогов:
  // "Можно нарисовать ещё 1 вершину", "Осталось еще 4 вершины", "ещё 3 вершины"
  const ruMatch = cleanText.match(
    /(?:можно\s*(?:ещ[её])?\s*нарисовать|осталось|ещ[её])\s*(?:ещ[её])?\s*(\d+)\s*вершин/i,
  )
  if (ruMatch) {
    return Number.parseInt(ruMatch[1], 10)
  }

  // 5. Английский паттерн: "You can draw 11 more vertices" или "1 more vertex"
  const enMatch = cleanText.match(/(\d+)\s*more\s*(?:vertex|vertices|vertic)/i)
  if (enMatch) {
    return Number.parseInt(enMatch[1], 10)
  }

  return null
}

const TARGETED_BANNER_SELECTORS = [
  '[class*="toolbar__message"]',
  '[class*="on-map-toolbar"] [class*="toolbar__message"]',
  '[class*="on-map-toolbar"] [class*="message"]',
  '[class*="on-map-toolbar"] [class*="warning"]',
  '[class*="on-map-toolbar"] [class*="alert"]',
  '[class*="on-map-toolbar"] [class*="error"]',
  '[class*="on-map-toolbar"] [class*="notice"]',
  '[class*="toolbar"] [class*="toolbar__message"]',
  '[class*="toolbar"] [class*="message"]',
  '[class*="toolbar"] [class*="warning"]',
  '[class*="toolbar"] [class*="alert"]',
  '[class*="toolbar"] [class*="notice"]',
  '[class*="toolbar"] [class*="hint"]',
  '[class*="toolbar-view"] [class*="message"]',
  '[class*="toolbar-view"] [class*="warning"]',
  '[class*="map-toolbar"] [class*="message"]',
  '[class*="map-toolbar"] [class*="warning"]',
  '.nk-on-map-toolbar__message',
  '.nk-toolbar__message',
  '.nk-toolbar__message-warning',
  '.nk-toolbar__message-alert',
  '.nk-toolbar__message-error',
  '[class*="message_theme_warning"]',
  '[class*="message_theme_alert"]',
  '[class*="message_theme_danger"]',
  '[class*="popup"] [class*="message"]',
  '[class*="popup"] [class*="content"]',
  '[class*="popup"] [class*="warning"]',
  '[class*="popup"] [class*="alert"]',
  '[class*="tooltip"] [class*="message"]',
  '[class*="tooltip"] [class*="content"]',
  '[class*="tooltip"]',
  '.nk-notification',
  '[class*="notification"]',
  '[class*="toast"]',
].join(', ')

let lastCheckTime = 0
let cachedRemaining: number | null = null

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
    [
      '[class*="on-map-toolbar"]',
      '.nk-on-map-toolbar',
      '[class*="toolbar-view"]',
      '.nk-toolbar-view',
      '[class*="map-toolbar"]',
      '.nk-map-toolbar',
      '[class*="geometry-editor"]',
      '.nk-geometry-editor',
      '[class*="drawing-toolbar"]',
    ].join(', '),
  )
  if (!toolbar) return false

  if (toolbar instanceof HTMLElement) {
    if (
      toolbar.style.display === 'none' ||
      toolbar.style.visibility === 'hidden' ||
      toolbar.hasAttribute('hidden') ||
      toolbar.getAttribute('aria-hidden') === 'true' ||
      toolbar.classList.contains('is-hidden')
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

  const hiddenAncestor = el.closest('.is-hidden, [class*="_hidden"], [class*="--hidden"], [hidden]')
  if (hiddenAncestor) {
    return false
  }

  let curr: Element | null = el
  while (curr && curr !== document.body) {
    if (curr instanceof HTMLElement) {
      if (curr.style.visibility === 'hidden' || curr.style.opacity === '0') {
        return false
      }
      if (curr.style.display === 'none' && !curr.hasAttribute('data-nmap-hidden-system-banner')) {
        return false
      }
    }
    curr = curr.parentElement
  }

  return true
}

const isTextLimitCandidate = (text: string | null | undefined): boolean => {
  if (!text) return false
  const lowerText = text.toLowerCase()
  return (
    lowerText.includes('вершин') ||
    lowerText.includes('vertic') ||
    lowerText.includes('лимит') ||
    lowerText.includes('limit')
  )
}

/**
 * Ищет в DOM системный баннер/сообщение о лимите вершин и возвращает остаток, если он найден.
 * Если shouldHide = true, скрывает найденное системное сообщение.
 */
export const findSystemRemainingVertices = (
  root: ParentNode = typeof document !== 'undefined' ? document : ({} as ParentNode),
  shouldHide = false,
): number | null => {
  if (!root || typeof root.querySelectorAll !== 'function') return null

  const targetedElements = root.querySelectorAll(TARGETED_BANNER_SELECTORS)

  for (const el of targetedElements) {
    if (el.id === 'nmap-point-counter-wrapper' || el.closest?.('#nmap-point-counter-wrapper')) {
      continue
    }

    if (!isBannerElementActive(el)) {
      continue
    }

    const text = el.textContent
    if (isTextLimitCandidate(text)) {
      const remaining = parseSystemLimitText(text)
      if (remaining !== null) {
        if (shouldHide) {
          hideSystemBannerElement(el)
        }
        return remaining
      }
    }
  }

  // Резервный поиск по текстовым узлам через TreeWalker на случай произвольных классов верстки
  if (typeof document !== 'undefined' && typeof document.createTreeWalker === 'function') {
    const walkRoot = root === document ? document.body || document.documentElement : (root as Node)
    if (walkRoot && isTextLimitCandidate(walkRoot.textContent)) {
      const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT)
      let textNode = walker.nextNode()
      while (textNode) {
        const parentEl = textNode.parentElement
        if (
          parentEl &&
          parentEl.id !== 'nmap-point-counter-wrapper' &&
          !parentEl.closest?.('#nmap-point-counter-wrapper, script, style, noscript') &&
          isBannerElementActive(parentEl)
        ) {
          const candidateText = parentEl.textContent
          if (isTextLimitCandidate(candidateText)) {
            const remaining = parseSystemLimitText(candidateText)
            if (remaining !== null) {
              if (shouldHide) {
                hideSystemBannerElement(parentEl)
              }
              return remaining
            }
          }
        }
        textNode = walker.nextNode()
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
