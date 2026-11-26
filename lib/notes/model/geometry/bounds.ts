import type { LonLat, NoteGeometry } from '../types'
import { circleRing } from './circle'
import { squareFromCorners } from './square'

type BoundingBox = [number, number, number, number]

/** Точки, по которым считается охват: круг разворачивается в короткое кольцо. */
const geometryCoordinates = (geometry: NoteGeometry): LonLat[] => {
  switch (geometry.kind) {
    case 'Point':
      return [geometry.coords]
    case 'Line':
    case 'Polygon':
      return geometry.coords
    case 'Square':
      return squareFromCorners(geometry.corners[0], geometry.corners[1]) ?? []
    case 'Circle':
      return circleRing(geometry.center, geometry.radiusMeters, 36)
  }
}

/** Ограничивающий прямоугольник [minLon, minLat, maxLon, maxLat]. */
export const geometryBounds = (geometry: NoteGeometry): BoundingBox | null => {
  const coords = geometryCoordinates(geometry).filter(
    (coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]),
  )
  if (coords.length === 0) return null

  const lons = coords.map((coord) => coord[0])
  const lats = coords.map((coord) => coord[1])
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

/**
 * Точка, к которой цепляется иконка и подпись.
 *
 * Для площадных объектов это центр рамки, а не центроид полигона: у сложной
 * формы центроид может оказаться вне контура.
 */
export const geometryAnchor = (geometry: NoteGeometry): LonLat | null => {
  if (geometry.kind === 'Point') return geometry.coords
  if (geometry.kind === 'Circle') return geometry.center
  if (geometry.kind === 'Square') {
    return [
      (geometry.corners[0][0] + geometry.corners[1][0]) / 2,
      (geometry.corners[0][1] + geometry.corners[1][1]) / 2,
    ]
  }

  const bounds = geometryBounds(geometry)
  return bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : null
}

/** Зум, при котором объект целиком попадает в экран с запасом. */
export const zoomForBounds = (bounds: BoundingBox, viewportPx = 800): number => {
  const lonSpan = Math.max(bounds[2] - bounds[0], 1e-6)
  const latSpan = Math.max(bounds[3] - bounds[1], 1e-6)
  const span = Math.max(lonSpan, latSpan)
  const zoom = Math.log2((360 * viewportPx) / (256 * span))
  return Math.min(19, Math.max(4, Math.floor(zoom)))
}
