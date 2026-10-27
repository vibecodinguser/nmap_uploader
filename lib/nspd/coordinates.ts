/**
 * Утилиты преобразования координат между Web Mercator (EPSG:3857) и WGS84 (EPSG:4326).
 */
import type { Feature, FeatureCollection, Geometry } from 'geojson'

const MERCATOR_RADIUS = 6_378_137

/** Преобразует координаты Web Mercator (EPSG:3857) в градусы WGS84 (EPSG:4326). */
export const mercatorToWgs84 = (x: number, y: number): [number, number] => {
  const lon = (x / MERCATOR_RADIUS) * (180 / Math.PI)
  const lat = (2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2) * (180 / Math.PI)
  return [lon, lat]
}

/** Преобразует координаты WGS84 в Web Mercator (EPSG:3857). */
export const wgs84ToMercator = (lon: number, lat: number): [number, number] => {
  const x = MERCATOR_RADIUS * lon * (Math.PI / 180)
  const y = MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * (Math.PI / 180)) / 2))
  return [x, y]
}

/** Проверяет, представлены ли координаты в метрической проекции Web Mercator. */
export const isMercatorCoordinate = (x: number, y: number): boolean => {
  return Math.abs(x) > 180 || Math.abs(y) > 90
}

/** Рекурсивно нормализует массив координат в WGS84 [lon, lat]. */
export const normalizeCoordinatesToWgs84 = (coords: unknown): unknown => {
  if (!Array.isArray(coords)) return coords

  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const [x, y] = coords as [number, number]
    if (isMercatorCoordinate(x, y)) {
      const [lon, lat] = mercatorToWgs84(x, y)
      return [lon, lat, ...coords.slice(2)]
    }
    return coords
  }

  return coords.map(normalizeCoordinatesToWgs84)
}

/** Приводит геометрию GeoJSON к координатам WGS84. */
export const normalizeGeometryToWgs84 = <G extends Geometry>(geometry: G): G => {
  if ('coordinates' in geometry && Array.isArray(geometry.coordinates)) {
    return {
      ...geometry,
      coordinates: normalizeCoordinatesToWgs84(geometry.coordinates),
    }
  }
  return geometry
}

/** Приводит Feature к координатам WGS84. */
export const normalizeFeatureToWgs84 = (feature: Feature): Feature => {
  if (!feature.geometry) return feature
  return {
    ...feature,
    geometry: normalizeGeometryToWgs84(feature.geometry),
  }
}

/** Приводит FeatureCollection к координатам WGS84. */
export const normalizeFeatureCollectionToWgs84 = (
  featureCollection: FeatureCollection,
): FeatureCollection => {
  return {
    ...featureCollection,
    features: featureCollection.features.map(normalizeFeatureToWgs84),
  }
}
