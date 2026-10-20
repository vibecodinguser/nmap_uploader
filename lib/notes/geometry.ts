export type NoteCoordinate = [number, number]
export type BoundingBox = [number, number, number, number]

/**
 * Вычисляет BoundingBox [minLon, minLat, maxLon, maxLat] для массива точек.
 */
export const calculateBoundingBox = (
  coords: readonly NoteCoordinate[] | undefined,
): BoundingBox | undefined => {
  if (!coords || coords.length <= 1) {
    return undefined
  }

  const lons = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])

  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

/**
 * Форматирует время для отображения в заметке (HH:MM).
 */
export const formatNoteTime = (date: Date = new Date()): string => {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}
