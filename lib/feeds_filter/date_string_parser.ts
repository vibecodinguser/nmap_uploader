import { parseRelativeDateOffset, RUSSIAN_MONTHS_MAP } from './relative_date_parser'

export * from './relative_date_parser'

/**
 * Разбирает текстовую строку даты/времени Народной карты в объект Date (чистая функция).
 */
export const parseEventDateString = (
  rawText: string,
  referenceTimestamp = Date.now(),
): Date | null => {
  const text = rawText.trim().toLowerCase()
  if (!text) {
    return null
  }

  // 1. Стандартный ISO или дата в формате YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const parsed = Date.parse(text)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }
  }

  // 2. Относительное время
  const relativeDate = parseRelativeDateOffset(text, referenceTimestamp)
  if (relativeDate) {
    return relativeDate
  }

  // 3. Одиночное время: "14:20", "09:05", "в 14:20"
  const timeOnlyMatch = text.match(/^(?:в\s*)?([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
  if (timeOnlyMatch) {
    const hours = Number.parseInt(timeOnlyMatch[1], 10)
    const minutes = Number.parseInt(timeOnlyMatch[2], 10)
    const d = new Date(referenceTimestamp)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  const refDate = new Date(referenceTimestamp)

  // 4. Числовой формат "DD.MM.YYYY" или "DD.MM.YY" (опционально с HH:MM)
  const ddmmyyyyMatch = text.match(
    /(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:[,\s]+(?:в\s*)?(\d{1,2}):(\d{2}))?/,
  )
  if (ddmmyyyyMatch) {
    const day = Number.parseInt(ddmmyyyyMatch[1], 10)
    const month = Number.parseInt(ddmmyyyyMatch[2], 10) - 1
    let year = Number.parseInt(ddmmyyyyMatch[3], 10)
    if (year < 100) {
      year += 2000
    }
    const hours = ddmmyyyyMatch[4] ? Number.parseInt(ddmmyyyyMatch[4], 10) : 12
    const minutes = ddmmyyyyMatch[5] ? Number.parseInt(ddmmyyyyMatch[5], 10) : 0
    return new Date(year, month, day, hours, minutes, 0, 0)
  }

  // 5. Формат с названием месяца: "15 октября 2026 в 14:20"
  const monthMatch = text.match(
    /(?:^|[^а-яё0-9])(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:[,\s]+(?:в\s*)?(\d{1,2}):(\d{2}))?/i,
  )
  if (monthMatch && monthMatch.index !== undefined) {
    const matchStart = monthMatch.index
    const prefix = text.slice(Math.max(0, matchStart - 20), matchStart).trim()
    const isAddress =
      /(?:ул(?:ица|\.)?|пер(?:еулок|\.)?|просп(?:ект|\.)?|пр-т|бул(?:ьвар|\.)?|б-р|пл(?:ощадь|\.)?|шоссе|туп(?:ик|\.)?|наб(?:ережная|\.)?|д(?:ом|\.)?|корп(?:ус|\.)?|стр(?:оение|\.)?)$/i.test(
        prefix,
      )

    if (!isAddress) {
      const day = Number.parseInt(monthMatch[1], 10)
      const rawMonth = monthMatch[2].slice(0, 3)
      const month = RUSSIAN_MONTHS_MAP[rawMonth]
      if (month !== undefined) {
        const hasExplicitYear = Boolean(monthMatch[3])
        const hasExplicitTime = Boolean(monthMatch[4])

        if (hasExplicitYear || hasExplicitTime || text.length <= 30) {
          const year = monthMatch[3] ? Number.parseInt(monthMatch[3], 10) : refDate.getFullYear()
          const hours = monthMatch[4] ? Number.parseInt(monthMatch[4], 10) : 12
          const minutes = monthMatch[5] ? Number.parseInt(monthMatch[5], 10) : 0

          const candidate = new Date(year, month, day, hours, minutes, 0, 0)
          if (!monthMatch[3] && candidate.getTime() > referenceTimestamp + 2 * 86400 * 1000) {
            candidate.setFullYear(year - 1)
          }
          return candidate
        }
      }
    }
  }

  return null
}

/**
 * Вычисляет давность события в днях по текстовой строке даты (чистая функция).
 */
export const calculateDayAgeFromDateText = (
  rawText: string,
  referenceTimestamp = Date.now(),
): number | null => {
  const text = rawText.trim().toLowerCase()
  if (!text) {
    return null
  }

  // 1. "только что", "сегодня", изолированное время "HH:MM" или "в HH:MM" — 0 дней
  if (
    text.includes('только что') ||
    text.includes('сегодня') ||
    /^(?:в\s*)?[012]?\d:[0-5]\d(?::[0-5]\d)?$/.test(text)
  ) {
    return 0
  }

  // 2. Относительное время в секундах, минутах, часах
  const hourMinMatch = text.match(/(\d+)\s*(сек|мин|час|ч\b)[а-яё]*\s*назад/i)
  if (hourMinMatch) {
    const val = Number.parseInt(hourMinMatch[1], 10)
    const unit = hourMinMatch[2].toLowerCase()
    if (unit.startsWith('час') || unit === 'ч') {
      return val >= 24 ? Math.floor(val / 24) : 0
    }
    return 0
  }

  // 3. "позавчера" — 2 дня
  if (text.includes('позавчера')) {
    return 2
  }

  // 4. "вчера" — 1 день
  if (text.includes('вчера')) {
    return 1
  }

  // 5. "N дня/дней назад"
  const daysAgoMatch = text.match(/(\d+)\s*(?:дн|ден)\w*\s*назад/)
  if (daysAgoMatch) {
    const days = Number.parseInt(daysAgoMatch[1], 10)
    if (!Number.isNaN(days)) {
      return days
    }
  }

  // 6. Календарные даты ("14 октября", "10.10.2026")
  const parsed = parseEventDateString(text, referenceTimestamp)
  if (parsed) {
    const refDate = new Date(referenceTimestamp)
    refDate.setHours(0, 0, 0, 0)
    const cardDate = new Date(parsed.getTime())
    cardDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((refDate.getTime() - cardDate.getTime()) / (24 * 60 * 60 * 1000))
    return Math.max(0, diffDays)
  }

  return null
}
