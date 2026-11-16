import type { DrawableNoteKind } from '../../protocol'
import type { NoteGeometry } from '../types'
import { distanceMeters } from './circle'
import { squareCornersFromDrag } from './square'

/**
 * Геометрия из того, что нарисовал пользователь.
 *
 * Точка, линия и многоугольник приходят набором вершин; квадрат и круг —
 * двумя точками (углы и «центр → окружность»). Возвращает `null`, если по
 * нарисованному фигуру не построить: например, протяжка нулевой длины.
 */
export const geometryFromDrawCoords = (
  kind: DrawableNoteKind,
  coords: [number, number][],
): NoteGeometry | null => {
  if (coords.length === 0) return null

  switch (kind) {
    case 'Point':
      return { kind: 'Point', coords: coords[0] }
    case 'Line':
      return coords.length >= 2 ? { kind: 'Line', coords } : null
    case 'Polygon':
      return coords.length >= 3 ? { kind: 'Polygon', coords } : null
    case 'Square': {
      const [start, end] = coords
      if (!start || !end) return null
      const corners = squareCornersFromDrag(start, end)
      // Вырожденная протяжка по одной оси не даёт квадрата.
      if (corners[0][0] === corners[1][0] || corners[0][1] === corners[1][1]) return null
      return { kind: 'Square', corners }
    }
    case 'Circle': {
      const [center, edge] = coords
      if (!center || !edge) return null
      const radiusMeters = distanceMeters(center, edge)
      if (!Number.isFinite(radiusMeters) || radiusMeters < 1) return null
      return { kind: 'Circle', center, radiusMeters }
    }
    default:
      return null
  }
}
