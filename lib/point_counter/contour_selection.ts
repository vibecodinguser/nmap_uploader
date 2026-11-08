/**
 * Распознавание экрана выбора контура в редакторе НЯК.
 *
 * У объектов, состоящих из нескольких самостоятельных отрезков, редактор сначала просит
 * выбрать контур: «Выберите контур для редактирования» / «Select a contour to edit».
 * Пока этот режим активен (и после выбора контура) счётчик вершин показывать нельзя:
 * суммарное число по таким отрезкам не имеет смысла.
 */

const PROMPT_PATTERNS = [
  /выберите\s+контур/i,
  /выберите\s+участок/i,
  /select\s+(a\s+)?contour/i,
  /choose\s+(a\s+)?contour/i,
] as const

const NOTIFICATION_SELECTOR =
  '.nk-notification-view, [class*="notification-view"], [class*="notification"]'

const isVisible = (el: Element): boolean => {
  if (!(el instanceof HTMLElement)) return true
  if (el.hasAttribute('hidden')) return false
  if (el.style.display === 'none' || el.style.visibility === 'hidden') return false
  return el.getBoundingClientRect().width > 0 || el.offsetParent !== null
}

/** Проверяет, содержит ли текст приглашение выбрать контур. */
export const isContourSelectionText = (text: string | null | undefined): boolean => {
  if (!text) return false
  const normalized = text.replace(/\s+/g, ' ').trim()
  return PROMPT_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * Ищет видимое системное приглашение выбрать контур.
 * Возвращает элемент приглашения или null.
 */
export const findContourSelectionPrompt = (
  root: ParentNode = typeof document !== 'undefined' ? document : ({} as ParentNode),
): Element | null => {
  if (!root || typeof root.querySelectorAll !== 'function') return null

  for (const el of root.querySelectorAll(NOTIFICATION_SELECTOR)) {
    if (el.id === 'nmap-point-counter-wrapper' || el.closest?.('#nmap-point-counter-wrapper')) {
      continue
    }
    if (!isVisible(el)) continue
    if (isContourSelectionText(el.textContent)) return el
  }

  return null
}

/** Возвращает true, если на экране сейчас просят выбрать контур. */
export const isContourSelectionActive = (root?: ParentNode): boolean =>
  findContourSelectionPrompt(root) !== null
