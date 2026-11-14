import type { LonLat } from '../types'

const METERS_PER_DEGREE = 111_320
const EARTH_RADIUS_METERS = 6_371_000
export const CIRCLE_SEGMENTS = 72
export const CIRCLE_MIN_RADIUS_METERS = 5

/** Длина одного градуса долготы на широте: к полюсам она стремится к нулю. */
const metersPerDegreeLon = (latitude: number): number => {
  const cos = Math.cos((latitude * Math.PI) / 180)
  return cos < 1e-6 ? 0 : METERS_PER_DEGREE * cos
}

/**
 * Кольцо точек круга.
 *
 * Круг хранится центром и радиусом в метрах, а на карту уходит кольцом. Это
 * позволяет менять радиус числом и держать форму круглой на любом зуме.
 */
export const circleRing = (
  center: LonLat,
  radiusMeters: number,
  segments: number = CIRCLE_SEGMENTS,
): LonLat[] => {
  const [lon, lat] = center
  const ring: LonLat[] = []
  const radius = Math.max(radiusMeters, CIRCLE_MIN_RADIUS_METERS)
  const dLat = radius / METERS_PER_DEGREE
  const dLon = radius / metersPerDegreeLon(lat)

  for (let index = 0; index < segments; index += 1) {
    const angle = (2 * Math.PI * index) / segments
    ring.push([lon + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)])
  }
  ring.push([ring[0][0], ring[0][1]])

  return ring
}

/** Расстояние по большому кругу между двумя точками в метрах. */
export const distanceMeters = (from: LonLat, to: LonLat): number => {
  const toRadians = (value: number): number => (value * Math.PI) / 180
  const dLat = toRadians(to[1] - from[1])
  const dLon = toRadians(to[0] - from[0])
  const lat1 = toRadians(from[1])
  const lat2 = toRadians(to[1])

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Радиус круга по центру и точке на окружности. */
export const radiusFromDrag = (center: LonLat, edge: LonLat): number =>
  Math.max(distanceMeters(center, edge), CIRCLE_MIN_RADIUS_METERS)
