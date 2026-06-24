import type { NmapIndex, NmapPoint } from '@/lib/nmap_index'

export const MIN_LAT = -90
export const MAX_LAT = 90
export const MIN_LON = -180
export const MAX_LON = 180
export const POINT_DESCRIPTION_MAX_LENGTH = 150

/** Проверяет, что координаты в допустимых диапазонах. */
export const areCoordinatesValid = ({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}): boolean =>
  MIN_LAT <= latitude && latitude <= MAX_LAT && MIN_LON <= longitude && longitude <= MAX_LON

/** Проверяет формат даты YYYY-MM-DD. */
export const isValidTargetDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

import { getPointForGeometry } from './geometry'

/** Создаёт index.json с одной фигурой (точкой, линией или полигоном). */
export const createGeometryIndex = ({
  coords,
  geomType,
  description,
  note_time,
  note_desc,
}: {
  coords: number[][]
  geomType: string
  description: string
  note_time?: string
  note_desc?: string
}): NmapIndex => {
  const sharedUuid = crypto.randomUUID()
  const pointCoords = getPointForGeometry(geomType, coords)
  const safeDesc = description.slice(0, POINT_DESCRIPTION_MAX_LENGTH)

  const points: Record<string, NmapPoint> = {}
  if (pointCoords) {
    const ptData: NmapPoint = { coords: pointCoords, desc: safeDesc }
    if (note_time) {
      ptData.note_time = note_time
    }
    if (note_desc) {
      ptData.note_desc = note_desc
    }
    points[sharedUuid] = ptData
  }

  const paths: Record<string, number[][]> = {}
  if (geomType !== 'Point' && coords.length > 1) {
    paths[sharedUuid] = coords
  }

  return {
    paths,
    points,
  }
}
