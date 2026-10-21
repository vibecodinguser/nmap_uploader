import { calculateDayAgeFromDateText, parseEventDateString } from './date_string_parser'

export * from './date_string_parser'

/**
 * Извлекает и парсит дату из карточки события .nk-event-view.
 */
export const parseEventCardDate = (
  card: HTMLElement,
  referenceTimestamp = Date.now(),
): Date | null => {
  // 1. Проверяем data-атрибуты с timestamp
  const dataTimestamp =
    card.getAttribute('data-timestamp') ||
    card.getAttribute('data-time') ||
    card.getAttribute('data-date')
  if (dataTimestamp) {
    const tsNum = Number(dataTimestamp)
    if (!Number.isNaN(tsNum) && tsNum > 0) {
      return new Date(tsNum < 1e11 ? tsNum * 1000 : tsNum)
    }
    const parsedDate = parseEventDateString(dataTimestamp, referenceTimestamp)
    if (parsedDate) {
      return parsedDate
    }
  }

  // 2. Проверяем элемент <time datetime="...">
  const timeEl = card.querySelector<HTMLElement>('time[datetime], [datetime]')
  if (timeEl) {
    const dt = timeEl.getAttribute('datetime')
    if (dt) {
      const parsed = parseEventDateString(dt, referenceTimestamp)
      if (parsed) {
        return parsed
      }
    }
  }

  // 3. Проверяем специализированные классы времени в карточке
  const dateSelectors = [
    '.nk-event-view__time',
    '.nk-event-view__date',
    '[class*="event-view__time"]',
    '[class*="event-view__date"]',
    '[class*="relative-time"]',
    '[class*="event-view__timestamp"]',
    'time',
  ]

  for (const selector of dateSelectors) {
    const element = card.querySelector<HTMLElement>(selector)
    if (element) {
      const parsed =
        parseEventDateString(element.getAttribute('title') || '', referenceTimestamp) ||
        parseEventDateString(element.getAttribute('aria-label') || '', referenceTimestamp) ||
        parseEventDateString(element.textContent || '', referenceTimestamp)
      if (parsed) {
        return parsed
      }
    }
  }

  // 4. Резервный поиск по футеру карточки
  const footerEl = card.querySelector<HTMLElement>(
    '.nk-event-view__footer, [class*="event-view__footer"]',
  )
  if (footerEl) {
    const parsedFooter = parseEventDateString(footerEl.textContent || '', referenceTimestamp)
    if (parsedFooter) {
      return parsedFooter
    }
  }

  // 5. Крайний резерв по тексту карточки
  return parseEventDateString(card.textContent || '', referenceTimestamp)
}

/**
 * Извлекает текстовую строку давности из элемента даты карточки события.
 */
export const getEventCardDateText = (card: HTMLElement): string => {
  const dateElement =
    card.querySelector<HTMLElement>(
      '.nk-date-time.nk-event-view__date, .nk-date-time_mode_relative, .nk-date-time, .nk-event-view__date, [class*="event-view__date"], [class*="relative-time"]',
    ) || card.querySelector<HTMLElement>('time')

  if (dateElement) {
    const directText = dateElement.textContent?.trim() || ''
    if (directText) {
      return directText
    }
    const title = dateElement.getAttribute('title')?.trim() || ''
    if (title) {
      return title
    }
    const ariaLabel = dateElement.getAttribute('aria-label')?.trim() || ''
    if (ariaLabel) {
      return ariaLabel
    }
  }

  return ''
}

/**
 * Определяет давность правки в полных днях (0 = сегодня, 1 = вчера, 2 = 2 дня назад и т.д.)
 */
export const getEventCardDayAge = (
  card: HTMLElement,
  referenceTimestamp = Date.now(),
): number | null => {
  const rawText = getEventCardDateText(card)
  if (!rawText) {
    const parsedDate = parseEventCardDate(card, referenceTimestamp)
    if (!parsedDate) {
      return null
    }
    const diffMs = referenceTimestamp - parsedDate.getTime()
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
  }

  const calculated = calculateDayAgeFromDateText(rawText, referenceTimestamp)
  if (calculated !== null) {
    return calculated
  }

  const parsedDate = parseEventCardDate(card, referenceTimestamp)
  if (!parsedDate) {
    return null
  }
  const diffMs = referenceTimestamp - parsedDate.getTime()
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
}
