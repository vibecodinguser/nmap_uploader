import type { Coordinate, NativeTracingMap, SegmentSnap } from './types'

export const snapToSegment = (
  point: number[],
  start: number[],
  end: number[],
): Omit<SegmentSnap, 'segmentIndex'> => {
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  const squaredLength = deltaX * deltaX + deltaY * deltaY
  if (squaredLength === 0) {
    return {
      ratio: 0,
      distance: Math.hypot(point[0] - start[0], point[1] - start[1]),
    }
  }
  const ratio = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY) / squaredLength),
  )
  return {
    ratio,
    distance: Math.hypot(
      point[0] - (start[0] + ratio * deltaX),
      point[1] - (start[1] + ratio * deltaY),
    ),
  }
}

export const findTargetSnap = (
  cursor: Coordinate,
  coordinates: Coordinate[],
  map: NativeTracingMap,
  threshold: number,
): SegmentSnap | null => {
  const zoom = map.getZoom()
  const projection = map.options.get('projection')
  const cursorPixels = projection.toGlobalPixels(cursor, zoom)
  const vertices = coordinates.map((coordinate) => projection.toGlobalPixels(coordinate, zoom))
  let nearest: SegmentSnap | null = null

  for (let index = 1; index < vertices.length; index += 1) {
    const current = snapToSegment(cursorPixels, vertices[index - 1], vertices[index])
    if (current.distance <= threshold && (!nearest || current.distance < nearest.distance)) {
      nearest = { ...current, segmentIndex: index - 1 }
    }
  }
  if (!nearest) {
    return null
  }
  return nearest
}
