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
 * Рассчитывает целевой календарный временной порог (в мс) для N календарных дней:
 * 1 день -> 00:00:00 сегодняшнего дня
 * 3 дня -> 00:00:00 позавчерашнего дня (сегодня + 2 дня назад)
 * 7 дней -> 00:00:00 за 6 дней до сегодня (сегодня + 6 дней назад)
 */
export const getTargetThresholdMs = (
  targetDays: number,
  referenceTimestamp = Date.now(),
): number => {
  const startOfToday = new Date(referenceTimestamp)
  startOfToday.setHours(0, 0, 0, 0)
  const normalizedDays = Math.max(1, targetDays)
  return startOfToday.getTime() - (normalizedDays - 1) * 24 * 60 * 60 * 1000
}

/**
 * Проверяет, есть ли среди карточек хотя бы одна карточка старше целевого периода (в днях или по порогу даты).
 */
export const hasCardOlderThanPeriod = (
  cards: HTMLElement[],
  targetDays: number,
  referenceTimestamp = Date.now(),
): boolean => {
  const thresholdMs = getTargetThresholdMs(targetDays, referenceTimestamp)

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
    if (dayAge !== null && dayAge >= targetDays) {
      return true
    }

    const parsedDate = parseEventCardDate(card, referenceTimestamp)
    if (parsedDate && parsedDate.getTime() < thresholdMs) {
      return true
    }
  }

  return false
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
