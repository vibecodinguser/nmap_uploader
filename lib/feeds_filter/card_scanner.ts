import { getEventCardDayAge, parseEventCardDate } from './date_parser'

/**
 * Находит последнюю карточку с известной давностью в днях, сканируя список карточек с конца.
 */
export const getLastCardWithDayAge = (
  cards: HTMLElement[],
  referenceTimestamp = Date.now(),
): { card: HTMLElement; dayAge: number } | null => {
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i]
    if (
      card.classList.contains('nk-event-view_skeleton') ||
      card.classList.contains('nk-spinner') ||
      card.getAttribute('aria-hidden') === 'true'
    ) {
      continue
    }
    const dayAge = getEventCardDayAge(card, referenceTimestamp)
    if (dayAge !== null) {
      return { card, dayAge }
    }
  }
  return null
}

/**
 * Рассчитывает целевой временной порог (в мс) для N суток.
 */
export const getTargetThresholdMs = (
  targetDays: number,
  referenceTimestamp = Date.now(),
): number => {
  const startOfToday = new Date(referenceTimestamp)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTodayMs = startOfToday.getTime()

  const daysAgoMs = referenceTimestamp - targetDays * 24 * 60 * 60 * 1000
  const calendarDaysAgoMs = startOfTodayMs - (targetDays - 1) * 24 * 60 * 60 * 1000

  return Math.min(calendarDaysAgoMs, daysAgoMs)
}

/**
 * Находит последнюю карточку с валидной датой, сканируя список карточек с конца.
 */
export const getLastCardWithDate = (
  cards: HTMLElement[],
  referenceTimestamp = Date.now(),
): { card: HTMLElement; date: Date } | null => {
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i]
    if (
      card.classList.contains('nk-event-view_skeleton') ||
      card.classList.contains('nk-spinner') ||
      card.getAttribute('aria-hidden') === 'true'
    ) {
      continue
    }
    const date = parseEventCardDate(card, referenceTimestamp)
    if (date) {
      return { card, date }
    }
  }
  return null
}
