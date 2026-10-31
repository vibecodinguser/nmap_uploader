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
    /лимит достигнут/i.test(cleanText) ||
    /нельзя нарисовать больше/i.test(cleanText) ||
    /больше нельзя добавить/i.test(cleanText) ||
    /limit reached/i.test(cleanText) ||
    /no more vertices/i.test(cleanText)
  ) {
    return 0
  }

  // 2. Русский паттерн: "Лимит — 500 вершин. Можно нарисовать ещё 11 вершин"
  // или "Можно нарисовать ещё 1 вершину", "Осталось ещё 4 вершины"
  const ruMatch = cleanText.match(
    /(?:можно нарисовать ещё|осталось ещё|ещё|осталось)\s*(\d+)\s*вершин/i,
  )
  if (ruMatch) {
    return Number.parseInt(ruMatch[1], 10)
  }

  // 3. Английский паттерн: "You can draw 11 more vertices" или "1 more vertex"
  const enMatch = cleanText.match(/(\d+)\s*more\s*(?:vertex|vertices|vertic)/i)
  if (enMatch) {
    return Number.parseInt(enMatch[1], 10)
  }

  return null
}

const TARGETED_BANNER_SELECTORS = [
  '[class*="toolbar__message"]',
  '[class*="on-map-toolbar"]',
  '[class*="toolbar"] [class*="message"]',
  '[class*="toolbar"] [class*="warning"]',
  '[class*="toolbar"] [class*="alert"]',
  '[class*="toolbar"] [class*="notice"]',
  '[class*="toolbar"] [class*="hint"]',
  '[class*="message_theme_warning"]',
  '[class*="message_theme_alert"]',
  '[class*="popup"] [class*="message"]',
  '[class*="notification"]',
].join(', ')

let lastCheckTime = 0
let cachedRemaining: number | null = null

/**
 * Ищет в DOM системный баннер/сообщение о лимите вершин и возвращает остаток, если он найден.
 * Выполняет только узконаправленный поиск по специализированным блокам подсказок тулбара.
 */
export const findSystemRemainingVertices = (
  root: ParentNode = typeof document !== 'undefined' ? document : ({} as ParentNode),
): number | null => {
  if (!root || typeof root.querySelectorAll !== 'function') return null

  const targetedElements = root.querySelectorAll(TARGETED_BANNER_SELECTORS)

  for (const el of targetedElements) {
    if (el.id === 'nmap-point-counter-wrapper' || el.closest?.('#nmap-point-counter-wrapper')) {
      continue
    }

    const text = el.textContent
    if (text && (text.includes('вершин') || text.includes('vertic'))) {
      const remaining = parseSystemLimitText(text)
      if (remaining !== null) return remaining
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
): number | null => {
  const now = Date.now()
  if (!force && now - lastCheckTime < 200) {
    return cachedRemaining
  }
  lastCheckTime = now
  cachedRemaining = findSystemRemainingVertices(root)
  return cachedRemaining
}

export const resetSystemRemainingCache = (): void => {
  lastCheckTime = 0
  cachedRemaining = null
}
