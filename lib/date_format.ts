import { isValidTargetDate } from '@/lib/point_uploader'

/** Форматирует дату в YYYY-MM-DD (локальное время). */
export const formatDateIso = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Разбирает YYYY-MM-DD в Date (полночь локального времени). */
export const parseDateIso = (value: string): Date | undefined => {
  if (!isValidTargetDate(value)) return undefined
  return new Date(`${value}T00:00:00`)
}

/** Форматирует дату для поля ввода: DD-MM-YYYY. */
export const formatDateDisplay = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day}-${month}-${year}`
}

/** Применяет маску DD-MM-YYYY к вводимым цифрам. */
export const formatDateDisplayInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

/** Разбирает DD-MM-YYYY в Date (полночь локального времени). */
export const parseDateDisplay = (value: string): Date | undefined => {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return undefined

  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  if (!isValidTargetDate(iso)) return undefined
  return new Date(`${iso}T00:00:00`)
}

/** Проверяет формат даты DD-MM-YYYY. */
export const isValidDisplayDate = (value: string): boolean => parseDateDisplay(value) !== undefined

/** Конвертирует DD-MM-YYYY в YYYY-MM-DD для API и папок на Диске. */
export const displayToIso = (value: string): string | undefined => {
  const parsed = parseDateDisplay(value)
  if (!parsed) return undefined
  return formatDateIso(parsed)
}

/** Нормализует дату из поля ввода в ISO для загрузки. */
export const normalizeDisplayTargetDate = (date: string): string | undefined => {
  const trimmed = date.trim()
  if (!trimmed) return undefined
  const iso = displayToIso(trimmed)
  if (!iso) {
    throw new Error('Неверный формат даты')
  }
  return iso
}
