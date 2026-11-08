/**
 * Чистая геометрия для подсчёта вершин: замыкание кольца, площадь, попадание точки,
 * проекция координат в пиксели карты.
 *
 * Ничего не знает про редактор, DOM и состояние — только числа.
 */

import type {
  EditorMapLike,
  PixelPoint,
  ProjectionLike,
  RingCoordinates,
  YmapsEventLike,
} from './editor_types'

const isSamePoint = (left: number[], right: number[]): boolean =>
  left[0] === right[0] && left[1] === right[1]

/** Проверяет, что кольцо замкнуто (первая и последняя точки совпадают). */
export const isClosedRing = (coords: RingCoordinates): boolean =>
  coords.length > 1 && isSamePoint(coords[0], coords[coords.length - 1])

/**
 * Считает вершины кольца.
 *
 * В модели редактора замкнутое кольцо хранит замыкающую точку, а при рисовании добавляется
 * ещё и «резиновая» вершина под курсором — обе не являются поставленными вершинами.
 */
export const countRingVertices = (coords: RingCoordinates, isDrawing = false): number => {
  if (coords.length === 0) return 0

  const closingPoint = isClosedRing(coords) ? 1 : 0
  const cursorPoint = isDrawing ? 1 : 0

  return Math.max(0, coords.length - closingPoint - cursorPoint)
}

/** Площадь кольца в пикселях (нужна, чтобы выбрать самый внутренний контур). */
export const getRingArea = (ring: PixelPoint[]): number => {
  if (ring.length < 3) return 0

  let sum = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index]
    const next = ring[index + 1]
    sum += current[0] * next[1] - next[0] * current[1]
  }

  return Math.abs(sum) / 2
}

/** Проверяет попадание точки в кольцо (алгоритм ray casting). */
export const isPointInRing = (point: PixelPoint, ring: PixelPoint[]): boolean => {
  if (ring.length < 3) return false

  let inside = false
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const [currentX, currentY] = ring[current]
    const [previousX, previousY] = ring[previous]
    const crossesHorizontalRay = currentY > point[1] !== previousY > point[1]
    if (!crossesHorizontalRay) continue

    const intersectionX =
      ((previousX - currentX) * (point[1] - currentY)) / (previousY - currentY) + currentX
    if (point[0] < intersectionX) inside = !inside
  }

  return inside
}

/**
 * Возвращает индекс самого внутреннего кольца, содержащего точку.
 * Для внешнего контура с дыркой это даёт дырку, для вложенных контуров — меньший по площади.
 */
export const findInnermostRingIndex = (point: PixelPoint, rings: PixelPoint[][]): number | null => {
  let bestIndex: number | null = null
  let bestArea = Number.POSITIVE_INFINITY

  rings.forEach((ring, index) => {
    if (!isPointInRing(point, ring)) return
    const area = getRingArea(ring)
    if (area < bestArea) {
      bestArea = area
      bestIndex = index
    }
  })

  return bestIndex
}

/** Переводит кольцо географических координат в пиксели карты. */
export const projectRingToPixels = (
  coords: RingCoordinates,
  projection: ProjectionLike,
  zoom: number,
): PixelPoint[] => coords.map((coord) => projection.toGlobalPixels(coord, zoom) as PixelPoint)

/** Извлекает пиксельные координаты клика из события карты. */
export const readClickPixels = (event: YmapsEventLike, map: EditorMapLike): PixelPoint | null => {
  const globalPixels = event.get('globalPixels')
  if (Array.isArray(globalPixels) && globalPixels.length === 2) {
    return [Number(globalPixels[0]), Number(globalPixels[1])]
  }

  const pagePixels = event.get('pagePixels')
  if (Array.isArray(pagePixels) && pagePixels.length === 2 && map.converter?.pageToGlobal) {
    const converted = map.converter.pageToGlobal([Number(pagePixels[0]), Number(pagePixels[1])])
    if (Array.isArray(converted) && converted.length === 2) {
      return [Number(converted[0]), Number(converted[1])]
    }
  }

  return null
}
