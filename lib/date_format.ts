import { isValidTargetDate } from '@/lib/point_uploader'

/** Форматирует дату в YYYY-MM-DD (локальное время). */
export const formatDateIso = (date: Date): string => {
  const year = date.getFullYear()
  const monthNum = date.getMonth() + 1
  const monthStr = String(monthNum)
  const month = monthStr.padStart(2, '0')
  const dayNum = date.getDate()
  const dayStr = String(dayNum)
  const day = dayStr.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Разбирает YYYY-MM-DD в Date (полночь локального времени). */
export const parseDateIso = (value: string): Date | undefined => {
  let result: Date | undefined
  if (isValidTargetDate(value)) {
    result = new Date(`${value}T00:00:00`)
  }
  return result
}

/** Форматирует дату для поля ввода: DD-MM-YYYY. */
export const formatDateDisplay = (date: Date): string => {
  const dayNum = date.getDate()
  const dayStr = String(dayNum)
  const day = dayStr.padStart(2, '0')
  const monthNum = date.getMonth() + 1
  const monthStr = String(monthNum)
  const month = monthStr.padStart(2, '0')
  const yearNum = date.getFullYear()
  const year = String(yearNum)
  return `${day}-${month}-${year}`
}

/** Применяет маску DD-MM-YYYY к вводимым цифрам. */
export const formatDateDisplayInput = (value: string): string => {
  const rawDigits = value.replace(/\D/g, '')
  const digits = rawDigits.slice(0, 8)
  let result = digits

  const dayPartLength = 2
  const monthPartLength = 4

  if (digits.length > monthPartLength) {
    const day = digits.slice(0, dayPartLength)
    const month = digits.slice(dayPartLength, monthPartLength)
    const year = digits.slice(monthPartLength)
    result = `${day}-${month}-${year}`
  } else if (digits.length > dayPartLength) {
    const day = digits.slice(0, dayPartLength)
    const month = digits.slice(dayPartLength)
    result = `${day}-${month}`
  }
  return result
}

/** Разбирает DD-MM-YYYY в Date (полночь локального времени). */
export const parseDateDisplay = (value: string): Date | undefined => {
  const trimmedValue = value.trim()
  const match = trimmedValue.match(/^(\d{2})[-./](\d{2})[-./](\d{4})$/)
  let result: Date | undefined
  if (match) {
    const [, day, month, year] = match
    const iso = `${year}-${month}-${day}`
    if (isValidTargetDate(iso)) {
      result = new Date(`${iso}T00:00:00`)
    }
  } else if (isValidTargetDate(trimmedValue)) {
    result = new Date(`${trimmedValue}T00:00:00`)
  }
  return result
}

/** Проверяет формат даты DD-MM-YYYY. */
export const isValidDisplayDate = (value: string): boolean => {
  return parseDateDisplay(value) !== undefined
}

/**
 * Форматирует отметку времени ISO в «дд.мм.гггг чч.мм» по местному времени.
 *
 * Точка между часами и минутами — как в дате: в карточке это одна строка
 * «16.11.2026 14.35», и разные разделители в ней выглядели бы опечаткой.
 *
 * Невалидная или пустая отметка даёт пустую строку, а не «Invalid Date»:
 * значение приходит из чужого JSON на Диске и может быть испорчено.
 */
export const formatDateTimeDisplay = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}.${month}.${date.getFullYear()} ${hours}.${minutes}`
}

/** Конвертирует DD-MM-YYYY в YYYY-MM-DD для API и папок на Диске. */
export const displayToIso = (value: string): string | undefined => {
  const parsed = parseDateDisplay(value)
  let result: string | undefined
  if (parsed) {
    result = formatDateIso(parsed)
  }
  return result
}

/** Нормализует дату из поля ввода в ISO для загрузки. */
export const normalizeDisplayTargetDate = (date: string): string | undefined => {
  const trimmed = date.trim()
  let result: string | undefined
  if (trimmed) {
    const iso = displayToIso(trimmed)
    if (!iso) {
      throw new Error('Неверный формат даты')
    }
    result = iso
  }
  return result
}
