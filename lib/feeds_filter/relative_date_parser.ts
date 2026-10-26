export const RUSSIAN_MONTHS_MAP: Record<string, number> = {
  янв: 0,
  фев: 1,
  мар: 2,
  апр: 3,
  май: 4,
  мая: 4,
  июн: 5,
  июл: 6,
  авг: 7,
  сен: 8,
  окт: 9,
  ноя: 10,
  дек: 11,
}

export const parseRelativeDateOffset = (text: string, referenceTimestamp: number): Date | null => {
  // 1. Относительное время: "только что"
  if (text.includes('только что')) {
    return new Date(referenceTimestamp)
  }

  // 2. Относительное время: N секунд / минут / часов / дней / недель / месяцев / лет назад
  const relativeMatch = text.match(/(\d+)\s*(сек|мин|час|ч\b|дн|ден|недел|месяц|год|лет)/)
  if (relativeMatch && text.includes('назад')) {
    const value = Number.parseInt(relativeMatch[1], 10)
    const unit = relativeMatch[2]
    if (!Number.isNaN(value)) {
      if (unit.startsWith('сек')) {
        return new Date(referenceTimestamp - value * 1000)
      }
      if (unit.startsWith('мин')) {
        return new Date(referenceTimestamp - value * 60 * 1000)
      }
      if (unit.startsWith('час') || unit === 'ч') {
        return new Date(referenceTimestamp - value * 3600 * 1000)
      }
      if (unit.startsWith('дн') || unit.startsWith('ден')) {
        return new Date(referenceTimestamp - value * 86400 * 1000)
      }
      if (unit.startsWith('недел')) {
        return new Date(referenceTimestamp - value * 7 * 86400 * 1000)
      }
      if (unit.startsWith('месяц')) {
        return new Date(referenceTimestamp - value * 30 * 86400 * 1000)
      }
      if (unit.startsWith('год') || unit.startsWith('лет')) {
        return new Date(referenceTimestamp - value * 365 * 86400 * 1000)
      }
    }
  }

  // Одиночные формы без числа: "неделю назад", "месяц назад", "год назад"
  if (text.includes('неделю назад') || text.includes('неделя назад')) {
    return new Date(referenceTimestamp - 7 * 86400 * 1000)
  }
  if (text.includes('месяц назад')) {
    return new Date(referenceTimestamp - 30 * 86400 * 1000)
  }
  if (text.includes('год назад')) {
    return new Date(referenceTimestamp - 365 * 86400 * 1000)
  }

  // 3. "сегодня [в/в,] HH:MM"
  const todayMatch = text.match(/(?:^|[^\wа-яё])сегодня[,\s]*(?:в\s*)?(\d{1,2}):(\d{2})/)
  if (todayMatch) {
    const hours = Number.parseInt(todayMatch[1], 10)
    const minutes = Number.parseInt(todayMatch[2], 10)
    const d = new Date(referenceTimestamp)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  // 4. "позавчера [в/в,] HH:MM"
  const dayBeforeMatch = text.match(/(?:^|[^\wа-яё])позавчера[,\s]*(?:в\s*)?(\d{1,2}):(\d{2})/)
  if (dayBeforeMatch) {
    const hours = Number.parseInt(dayBeforeMatch[1], 10)
    const minutes = Number.parseInt(dayBeforeMatch[2], 10)
    const d = new Date(referenceTimestamp - 2 * 86400 * 1000)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  // 5. "вчера [в/в,] HH:MM"
  const yesterdayMatch = text.match(/(?:^|[^\wа-яё])вчера[,\s]*(?:в\s*)?(\d{1,2}):(\d{2})/)
  if (yesterdayMatch) {
    const hours = Number.parseInt(yesterdayMatch[1], 10)
    const minutes = Number.parseInt(yesterdayMatch[2], 10)
    const d = new Date(referenceTimestamp - 86400 * 1000)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  return null
}
