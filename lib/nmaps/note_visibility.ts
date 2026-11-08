/**
 * Управление видимостью объектов заметок на карте.
 *
 * Сохранённые заметки рисует сам редактор (слой «Трекер»), а расширение
 * рисует только несохранённые объекты. Поэтому скрытие работает в два шага:
 * свои объекты просто не отправляем, а нативные находим в коллекции карты и
 * переключаем им `visible`.
 */
import type { DrawMapObjectsDetail, MapObjectLike } from '@/lib/nmaps_draw_objects'
import type { YmapsMapLike } from './map_discovery'

type YmapsGeoObjectLike = {
  properties?: { get?: (name: string) => unknown }
  geometry?: { getCoordinates?: () => unknown }
  options?: { set?: (name: string, value: unknown) => void; get?: (name: string) => unknown }
  getLength?: () => number
  get?: (index: number) => unknown
  each?: (callback: (object: unknown) => void) => void
}

const HIDDEN_OPTION = 'visible'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const coordinatesKey = (coordinates: unknown): string | null => {
  if (!Array.isArray(coordinates)) return null
  const flat = coordinates.flat(Number.POSITIVE_INFINITY)
  if (!flat.every((value) => typeof value === 'number')) return null
  return flat.map((value) => (value as number).toFixed(7)).join(',')
}

const readObjectId = (object: YmapsGeoObjectLike): string | null => {
  try {
    const id = object.properties?.get?.('id')
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

const readCoordinates = (object: YmapsGeoObjectLike): unknown => {
  try {
    return object.geometry?.getCoordinates?.()
  } catch {
    return null
  }
}

const setVisible = (object: YmapsGeoObjectLike, visible: boolean): void => {
  try {
    object.options?.set?.(HIDDEN_OPTION, visible)
  } catch {
    // Чужой объект может быть заморожен — молча пропускаем.
  }
}

/** Собирает объекты карты, у которых есть свойства или геометрия. */
const collectGeoObjects = (root: unknown, result: YmapsGeoObjectLike[], depth = 0): void => {
  if (depth > 4 || !isRecord(root)) return
  const candidate = root as YmapsGeoObjectLike

  const hasLength = typeof candidate.getLength === 'function'
  if (hasLength) {
    let length = 0
    try {
      length = candidate.getLength?.() ?? 0
    } catch {
      return
    }
    for (let index = 0; index < length; index += 1) {
      let child: unknown
      try {
        child = candidate.get?.(index)
      } catch {
        continue
      }
      if (child === candidate) continue
      collectGeoObjects(child, result, depth + 1)
    }
    return
  }

  if (candidate.properties || candidate.geometry) {
    result.push(candidate)
  }
}

const buildCoordinateIndex = (points: MapObjectLike[]): Map<string, string> => {
  const index = new Map<string, string>()
  for (const point of points) {
    const id = point.id
    if (!id) continue
    const key = coordinatesKey(point.geomCoords)
    if (key) index.set(key, id)
  }
  return index
}

/**
 * Применяет скрытие к объектам на карте.
 *
 * Точки нативного слоя несут `properties.id`, поэтому находятся точно.
 * Линии и полигоны идентификатора не имеют — их сопоставляем по координатам.
 */
export const applyNoteVisibility = (
  detail: DrawMapObjectsDetail,
  getMap: () => YmapsMapLike | null = () => null,
): void => {
  const map = getMap() as unknown as Record<string, unknown> | null
  if (!map) {
    return
  }

  const hidden = new Set(detail.hiddenIds ?? [])
  const coordinateIndex = buildCoordinateIndex(detail.points)
  // Трогаем только объекты наших заметок: чужие объекты редактора не наше дело.
  const noteIds = new Set<string>()
  for (const point of detail.points) {
    if (point.id) noteIds.add(point.id)
    if (point.localId) noteIds.add(point.localId)
  }
  if (noteIds.size === 0) {
    return
  }

  const objects: YmapsGeoObjectLike[] = []
  collectGeoObjects(map.geoObjects, objects)

  for (const object of objects) {
    const propertyId = readObjectId(object)
    const resolvedId =
      propertyId ??
      (() => {
        const key = coordinatesKey(readCoordinates(object))
        return key ? (coordinateIndex.get(key) ?? null) : null
      })()

    if (!resolvedId || !noteIds.has(resolvedId)) continue
    setVisible(object, !hidden.has(resolvedId))
  }
}
