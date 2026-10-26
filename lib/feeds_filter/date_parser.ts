import { calculateDayAgeFromDateText, parseEventDateString } from './date_string_parser'

export * from './date_string_parser'

export const TARGET_EVENT_DATE_SELECTORS = [
  '.nk-date-time.nk-date-time_mode_relative.nk-event-view__date',
  '.nk-date-time.nk-event-view__date',
  '.nk-event-view__date',
  '.nk-date-time_mode_relative',
  '.nk-date-time',
  '.nk-event-view__time',
  '[class*="event-view__date"]',
  '[class*="event-view__time"]',
  'time',
]

/**
 * Находит основной DOM-элемент даты в карточке события.
 */
export const findEventCardDateElement = (card: HTMLElement): HTMLElement | null => {
  for (const selector of TARGET_EVENT_DATE_SELECTORS) {
    const el = card.querySelector<HTMLElement>(selector)
    if (el) {
      return el
    }
  }
  return null
}

/**
 * Извлекает и парсит дату из карточки события .nk-event-view.
 */
export const parseEventCardDate = (
  card: HTMLElement,
  referenceTimestamp = Date.now(),
): Date | null => {
  // 1. Приоритетный поиск по целевому элементу даты правки
  const dateEl = findEventCardDateElement(card)
  if (dateEl) {
    // Всплывающий балун при наведении задается через title
    const title = dateEl.getAttribute('title')?.trim()
    if (title) {
      const parsedTitle = parseEventDateString(title, referenceTimestamp)
      if (parsedTitle) {
        return parsedTitle
      }
    }

    const dt = dateEl.getAttribute('datetime')?.trim()
    if (dt) {
      const parsedDt = parseEventDateString(dt, referenceTimestamp)
      if (parsedDt) {
        return parsedDt
      }
    }

    const ariaLabel = dateEl.getAttribute('aria-label')?.trim()
    if (ariaLabel) {
      const parsedAria = parseEventDateString(ariaLabel, referenceTimestamp)
      if (parsedAria) {
        return parsedAria
      }
    }

    const dataTitle = dateEl.getAttribute('data-title')?.trim()
    if (dataTitle) {
      const parsedDataTitle = parseEventDateString(dataTitle, referenceTimestamp)
      if (parsedDataTitle) {
        return parsedDataTitle
      }
    }

    const dataTooltip = dateEl.getAttribute('data-tooltip')?.trim()
    if (dataTooltip) {
      const parsedDataTooltip = parseEventDateString(dataTooltip, referenceTimestamp)
      if (parsedDataTooltip) {
        return parsedDataTooltip
      }
    }

    const parentTitle = dateEl.parentElement?.getAttribute('title')?.trim()
    if (parentTitle) {
      const parsedParentTitle = parseEventDateString(parentTitle, referenceTimestamp)
      if (parsedParentTitle) {
        return parsedParentTitle
      }
    }

    const text = dateEl.textContent?.trim()
    if (text) {
      const parsedText = parseEventDateString(text, referenceTimestamp)
      if (parsedText) {
        return parsedText
      }
    }
  }

  // 2. Проверяем любые элементы с [title] внутри карточки
  const titleEls = card.querySelectorAll<HTMLElement>('[title]')
  for (const el of titleEls) {
    const titleVal = el.getAttribute('title')?.trim()
    if (titleVal) {
      const parsed = parseEventDateString(titleVal, referenceTimestamp)
      if (parsed) {
        return parsed
      }
    }
  }

  // 3. Проверяем data-атрибуты с timestamp на самой карточке
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

  // 4. Проверяем элемент <time datetime="...">
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

  // 5. Резервный поиск по футеру карточки
  const footerEl = card.querySelector<HTMLElement>(
    '.nk-event-view__footer, [class*="event-view__footer"]',
  )
  if (footerEl) {
    const parsedFooter = parseEventDateString(footerEl.textContent || '', referenceTimestamp)
    if (parsedFooter) {
      return parsedFooter
    }
  }

  // 6. Крайний резерв по тексту всей карточки
  return parseEventDateString(card.textContent || '', referenceTimestamp)
}

/**
 * Извлекает текстовую строку давности из элемента даты карточки события.
 */
export const getEventCardDateText = (card: HTMLElement): string => {
  const dateElement = findEventCardDateElement(card)

  if (dateElement) {
    const title = dateElement.getAttribute('title')?.trim() || ''
    if (title) {
      return title
    }
    const parentTitle = dateElement.parentElement?.getAttribute('title')?.trim() || ''
    if (parentTitle) {
      return parentTitle
    }
    const directText = dateElement.textContent?.trim() || ''
    if (directText) {
      return directText
    }
    const ariaLabel = dateElement.getAttribute('aria-label')?.trim() || ''
    if (ariaLabel) {
      return ariaLabel
    }
  }

  // Резервный поиск по элементам с title
  const titledEl = card.querySelector<HTMLElement>('[title]')
  if (titledEl) {
    const title = titledEl.getAttribute('title')?.trim()
    if (title) {
      return title
    }
  }

  return ''
}

/**
 * Определяет давность правки в полных календарных днях (0 = сегодня, 1 = вчера, 2 = 2 дня назад и т.д.)
 */
export const getEventCardDayAge = (
  card: HTMLElement,
  referenceTimestamp = Date.now(),
): number | null => {
  // 1. Приоритетный расчет по точной дате события
  const parsedDate = parseEventCardDate(card, referenceTimestamp)
  if (parsedDate) {
    const refDate = new Date(referenceTimestamp)
    refDate.setHours(0, 0, 0, 0)
    const cardDate = new Date(parsedDate.getTime())
    cardDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((refDate.getTime() - cardDate.getTime()) / (24 * 60 * 60 * 1000))
    return Math.max(0, diffDays)
  }

  // 2. Резервный расчет по строке текста даты элемента
  const rawText = getEventCardDateText(card)
  if (rawText) {
    const calculated = calculateDayAgeFromDateText(rawText, referenceTimestamp)
    if (calculated !== null) {
      return calculated
    }
  }

  // 3. Крайний резервный расчет по тексту всей карточки
  const cardText = card.textContent?.trim() || ''
  if (cardText) {
    const calculated = calculateDayAgeFromDateText(cardText, referenceTimestamp)
    if (calculated !== null) {
      return calculated
    }
  }

  return null
}
