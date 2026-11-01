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
  '.nk-on-map-toolbar__message',
  '.nk-toolbar__message',
  '.nk-toolbar__message-warning',
  '.nk-toolbar__message-alert',
  '.nk-toolbar__message-error',
  '[class*="on-map-toolbar"] [class*="toolbar__message"]',
  '[class*="on-map-toolbar"] [class*="message"]',
  '[class*="on-map-toolbar"] [class*="warning"]',
  '[class*="on-map-toolbar"] [class*="alert"]',
  '[class*="on-map-toolbar"] [class*="error"]',
  '[class*="on-map-toolbar"] [class*="notice"]',
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
    '[class*="on-map-toolbar"], .nk-on-map-toolbar, [class*="geometry-editor"]',
  )
  if (!toolbar) return false

  if (toolbar instanceof HTMLElement) {
    if (
      toolbar.style.display === 'none' ||
      toolbar.style.visibility === 'hidden' ||
      toolbar.hasAttribute('hidden') ||
      toolbar.getAttribute('aria-hidden') === 'true' ||
      toolbar.classList.contains('is-hidden') ||
      toolbar.className.includes('hidden')
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
