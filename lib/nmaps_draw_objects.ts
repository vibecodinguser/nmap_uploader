import { displayToIso } from '@/lib/date_format'
import type { NmapIndex } from '@/lib/nmap_index'

export type PolygonSnapTarget = {
  id: string
  coordinates: [number, number][]
}

export type MapObjectLike = {
  id?: string
  localId?: string
  geomType?: string
  geomCoords?: [number, number][]
  [key: string]: unknown
}

export type DrawMapObjectsDetail = {
  points: MapObjectLike[]
  snapTargets: PolygonSnapTarget[]
}

const isCoordinate = (value: unknown): value is [number, number] =>
  Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1])

const countUniqueCoordinates = (coordinates: [number, number][]): number =>
  new Set(coordinates.map(([longitude, latitude]) => `${longitude}:${latitude}`)).size

const coordinatesEqual = (left: [number, number], right: [number, number]): boolean =>
  left[0] === right[0] && left[1] === right[1]

export const normalizePolygonCoordinates = (value: unknown): [number, number][] | null => {
  if (!Array.isArray(value)) {
    return null
  }

  const coordinates = value.filter(isCoordinate)
  if (countUniqueCoordinates(coordinates) < 3) {
    return null
  }

  const normalized = coordinates.map(
    ([longitude, latitude]) => [longitude, latitude] as [number, number],
  )
  if (!coordinatesEqual(normalized[0], normalized.at(-1) as [number, number])) {
    normalized.push([...normalized[0]])
  }
  return normalized
}

export const createPolygonSnapTarget = (note: MapObjectLike): PolygonSnapTarget | null => {
  const id = note.id ?? note.localId
  const coordinates = normalizePolygonCoordinates(note.geomCoords)

  if (note.geomType !== 'Polygon' || !id || !coordinates) {
    return null
  }

  return { id, coordinates }
}

export const createPolygonSnapTargets = (points: MapObjectLike[]): PolygonSnapTarget[] =>
  points.reduce<PolygonSnapTarget[]>((targets, point) => {
    const target = createPolygonSnapTarget(point)
    if (target) {
      targets.push(target)
    }
    return targets
  }, [])

export const createDrawMapObjectsDetail = (
  points: MapObjectLike[],
  snapTargets: PolygonSnapTarget[],
): DrawMapObjectsDetail => ({ points, snapTargets })

export const createDrawMapObjectsFromNmapIndex = (
  index: NmapIndex,
  selectedDate: string,
): DrawMapObjectsDetail => {
  const points = Object.entries(index.points).map(([id, point]) => {
    const path = index.paths?.[id]?.filter(isCoordinate)
    let geomType = 'Point'

    if (path?.length) {
      geomType =
        path.length > 2 && coordinatesEqual(path[0], path.at(-1) as [number, number])
          ? 'Polygon'
          : 'LineString'
    }

    return {
      id,
      name: point.desc,
      latitude: point.coords[1],
      longitude: point.coords[0],
      date: selectedDate,
      noteTime: point.note_time,
      noteDesc: point.note_desc,
      geomType,
      geomCoords: path ?? [point.coords],
    }
  })

  return createDrawMapObjectsDetail(points, createPolygonSnapTargets(points))
}

export const loadDrawMapObjectsForDate = async ({
  selectedDate,
  token,
  downloadIndex,
}: {
  selectedDate: string
  token: string
  downloadIndex: (input: { token: string; targetDate: string }) => Promise<NmapIndex | null>
}): Promise<DrawMapObjectsDetail> => {
  const targetDate = displayToIso(selectedDate)
  if (!targetDate) {
    return createDrawMapObjectsDetail([], [])
  }

  const index = await downloadIndex({ token, targetDate })
  return index
    ? createDrawMapObjectsFromNmapIndex(index, selectedDate)
    : createDrawMapObjectsDetail([], [])
}

export const parseDrawMapObjectsDetail = (raw: unknown): DrawMapObjectsDetail | null => {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  if (!Array.isArray(record.points)) {
    return null
  }

  const rawTargets = Array.isArray(record.snapTargets) ? record.snapTargets : []
  const snapTargets = rawTargets.reduce<PolygonSnapTarget[]>((targets, rawTarget) => {
    if (!rawTarget || typeof rawTarget !== 'object') {
      return targets
    }
    const target = rawTarget as Record<string, unknown>
    const coordinates = normalizePolygonCoordinates(target.coordinates)

    if (typeof target.id === 'string' && coordinates) {
      targets.push({ id: target.id, coordinates })
    }
    return targets
  }, [])

  return {
    points: record.points as MapObjectLike[],
    snapTargets,
  }
}
