import type { LonLat } from '../types'

/**
 * Квадрат по двум противоположным углам.
 *
 * Стороны идут вдоль параллелей и меридианов — так квадрат совпадает с тем,
 * что видит пользователь на карте Яндекса, и его можно править как «угол —
 * угол», а не как свободный четырёхугольник.
 */
export const squareFromCorners = (a: LonLat, b: LonLat): LonLat[] | null => {
  const [lon1, lat1] = a
  const [lon2, lat2] = b

  if (![lon1, lat1, lon2, lat2].every((value) => Number.isFinite(value))) return null
  if (lon1 === lon2 || lat1 === lat2) return null

  return [
    [lon1, lat1],
    [lon2, lat1],
    [lon2, lat2],
    [lon1, lat2],
    [lon1, lat1],
  ]
}

/** Вторая вершина квадрата из протяжки: углы нормализуются в любом порядке. */
export const squareCornersFromDrag = (start: LonLat, end: LonLat): [LonLat, LonLat] => [
  [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
  [Math.max(start[0], end[0]), Math.max(start[1], end[1])],
]
