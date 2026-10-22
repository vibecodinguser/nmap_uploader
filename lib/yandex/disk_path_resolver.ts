import { YANDEX_DISK_FOLDER } from './constants'

/**
 * Формирует логический путь к целевой папке на Яндекс.Диске с учётом даты.
 */
export const resolveFolderPath = ({
  targetDate,
  includeToday = true,
}: {
  targetDate?: string
  includeToday?: boolean
}): string => {
  const basePath = YANDEX_DISK_FOLDER.replace(/\/+$/, '')

  if (targetDate) {
    return `${basePath}/${targetDate}`
  }

  if (includeToday) {
    const todayDate = new Date()
    const todayIso = todayDate.toISOString()
    const todayStr = todayIso.slice(0, 10)
    return `${basePath}/${todayStr}`
  }

  return basePath
}
