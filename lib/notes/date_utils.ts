const TRACKER_DATE_REGEX = /(\d{2})\.(\d{2})\.(\d{4})/

/**
 * Извлекает дату в формате DD-MM-YYYY из текста слоя трекеров Народной карты.
 */
export const extractTrackerDate = (input: unknown): string | undefined => {
  if (typeof input !== 'string') {
    return undefined
  }

  const match = TRACKER_DATE_REGEX.exec(input)
  if (!match) {
    return undefined
  }

  return `${match[1]}-${match[2]}-${match[3]}`
}
