import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import { extractPaths } from '@/lib/geometry'

/** Типы геометрии GeoJSON (RFC 7946, §1.4) — регистрозависимые. */
export const GEOJSON_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

/** Корневые типы GeoJSON (RFC 7946, §3). */
export const GEOJSON_ROOT_TYPES = new Set([
  ...GEOJSON_GEOMETRY_TYPES,
  'Feature',
  'FeatureCollection',
])

type GeoJsonRoot = Feature | FeatureCollection | Geometry

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

/** longitude WGS84 (RFC 7946, §4). */
export const isValidGeoJsonLongitude = (value: number): boolean => value >= -180 && value <= 180

/** latitude WGS84 (RFC 7946, §4). */
export const isValidGeoJsonLatitude = (value: number): boolean => value >= -90 && value <= 90

const assertFiniteNumber = (value: number, context: string): void => {
  if (!Number.isFinite(value)) {
    throw toProcessingError(`${context}: недопустимое число (NaN или Infinity)`)
  }
}

/** Проверяет Position: [lon, lat] или [lon, lat, alt] (RFC 7946, §3.1.1). */
export const validateGeoJsonPosition = (position: unknown, context: string): void => {
  if (!Array.isArray(position)) {
    throw toProcessingError(`${context}: position должна быть массивом чисел`)
  }

  if (position.length < 2) {
    throw toProcessingError(`${context}: position должна содержать минимум longitude и latitude`)
  }

  if (position.length > 3) {
    throw toProcessingError(
      `${context}: position не должна содержать более 3 элементов (RFC 7946, §3.1.1)`,
    )
  }

  const longitude = Number(position[0])
  const latitude = Number(position[1])
  assertFiniteNumber(longitude, `${context}.longitude`)
  assertFiniteNumber(latitude, `${context}.latitude`)

  if (!isValidGeoJsonLongitude(longitude)) {
    throw toProcessingError(`${context}: longitude ${longitude} вне диапазона [-180, 180]`)
  }
  if (!isValidGeoJsonLatitude(latitude)) {
    throw toProcessingError(`${context}: latitude ${latitude} вне диапазона [-90, 90]`)
  }

  if (position.length === 3) {
    assertFiniteNumber(Number(position[2]), `${context}.altitude`)
  }
}

const validateLinearRing = (ring: unknown, context: string): void => {
  if (!Array.isArray(ring)) {
    throw toProcessingError(`${context}: linear ring должен быть массивом позиций`)
  }

  if (ring.length < 4) {
    throw toProcessingError(
      `${context}: linear ring должен содержать минимум 4 позиции (RFC 7946, §3.1.6)`,
    )
  }

  ring.forEach((position, index) => {
    validateGeoJsonPosition(position, `${context}[${index}]`)
  })

  const first = ring[0] as Position
  const last = ring[ring.length - 1] as Position
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw toProcessingError(
      `${context}: linear ring должен быть замкнут (первая и последняя позиции совпадают)`,
    )
  }
}

const rejectLegacyCrs = (value: object, context: string): void => {
  if ('crs' in value) {
    throw toProcessingError(
      `${context}: член "crs" удалён из GeoJSON (RFC 7946, §4); используйте WGS 84`,
    )
  }
}

/** Проверяет bbox: длина 2*n, n=2 или 3 (RFC 7946, §5). */
export const validateGeoJsonBbox = (bbox: unknown, context: string): void => {
  if (!Array.isArray(bbox)) {
    throw toProcessingError(`${context}: bbox должен быть массивом чисел`)
  }

  if (bbox.length !== 4 && bbox.length !== 6) {
    throw toProcessingError(`${context}: bbox должен содержать 4 или 6 чисел (RFC 7946, §5)`)
  }

  bbox.forEach((value, index) => {
    assertFiniteNumber(Number(value), `${context}[${index}]`)
  })
}

/** Проверяет Geometry object (RFC 7946, §3.1). */
export const validateGeoJsonGeometry = (geometry: unknown, context = 'geometry'): void => {
  if (!geometry || typeof geometry !== 'object') {
    throw toProcessingError(`${context}: geometry должна быть объектом`)
  }

  const geom = geometry as Geometry & { bbox?: unknown; crs?: unknown }
  if (typeof geom.type !== 'string' || !GEOJSON_GEOMETRY_TYPES.has(geom.type)) {
    throw toProcessingError(
      `${context}: недопустимый type геометрии; ожидается один из RFC 7946 §1.4`,
    )
  }

  rejectLegacyCrs(geom, context)
  if (geom.bbox != null) validateGeoJsonBbox(geom.bbox, `${context}.bbox`)

  switch (geom.type) {
    case 'Point':
      validateGeoJsonPosition((geom as Point).coordinates, `${context}.coordinates`)
      return
    case 'MultiPoint':
      ;(geom as MultiPoint).coordinates.forEach((position, index) => {
        validateGeoJsonPosition(position, `${context}.coordinates[${index}]`)
      })
      return
    case 'LineString': {
      const coordinates = (geom as LineString).coordinates
      if (coordinates.length < 2) {
        throw toProcessingError(
          `${context}: LineString должен содержать минимум 2 позиции (RFC 7946, §3.1.4)`,
        )
      }
      coordinates.forEach((position, index) => {
        validateGeoJsonPosition(position, `${context}.coordinates[${index}]`)
      })
      return
    }
    case 'MultiLineString':
      ;(geom as MultiLineString).coordinates.forEach((line, lineIndex) => {
        if (line.length < 2) {
          throw toProcessingError(
            `${context}.coordinates[${lineIndex}]: LineString должен содержать минимум 2 позиции`,
          )
        }
        line.forEach((position, index) => {
          validateGeoJsonPosition(position, `${context}.coordinates[${lineIndex}][${index}]`)
        })
      })
      return
    case 'Polygon':
      ;(geom as Polygon).coordinates.forEach((ring, ringIndex) => {
        validateLinearRing(ring, `${context}.coordinates[${ringIndex}]`)
      })
      return
    case 'MultiPolygon':
      ;(geom as MultiPolygon).coordinates.forEach((polygon, polygonIndex) => {
        polygon.forEach((ring, ringIndex) => {
          validateLinearRing(ring, `${context}.coordinates[${polygonIndex}][${ringIndex}]`)
        })
      })
      return
    case 'GeometryCollection':
      if (!Array.isArray((geom as GeometryCollection).geometries)) {
        throw toProcessingError(`${context}: GeometryCollection.geometries должен быть массивом`)
      }
      ;(geom as GeometryCollection).geometries.forEach((part, index) => {
        validateGeoJsonGeometry(part, `${context}.geometries[${index}]`)
      })
  }
}

/** Проверяет Feature (RFC 7946, §3.2). */
export const validateGeoJsonFeature = (feature: unknown, context = 'Feature'): void => {
  if (!feature || typeof feature !== 'object') {
    throw toProcessingError(`${context}: Feature должен быть объектом`)
  }

  const obj = feature as Feature & { bbox?: unknown; crs?: unknown }
  if (obj.type !== 'Feature') {
    throw toProcessingError(`${context}: type должен быть "Feature"`)
  }

  rejectLegacyCrs(obj, context)
  if (obj.bbox != null) validateGeoJsonBbox(obj.bbox, `${context}.bbox`)

  if (!('properties' in obj)) {
    throw toProcessingError(`${context}: Feature должен содержать член properties (RFC 7946, §3.2)`)
  }

  if (
    obj.properties !== null &&
    (typeof obj.properties !== 'object' || Array.isArray(obj.properties))
  ) {
    throw toProcessingError(`${context}: properties должен быть объектом или null`)
  }

  if (!('geometry' in obj)) {
    throw toProcessingError(`${context}: Feature должен содержать член geometry (RFC 7946, §3.2)`)
  }

  if (obj.geometry !== null) {
    validateGeoJsonGeometry(obj.geometry, `${context}.geometry`)
  }
}

/** Проверяет FeatureCollection (RFC 7946, §3.3). */
export const validateGeoJsonFeatureCollection = (
  collection: unknown,
  context = 'FeatureCollection',
): void => {
  if (!collection || typeof collection !== 'object') {
    throw toProcessingError(`${context}: FeatureCollection должен быть объектом`)
  }

  const obj = collection as FeatureCollection & { bbox?: unknown; crs?: unknown }
  if (obj.type !== 'FeatureCollection') {
    throw toProcessingError(`${context}: type должен быть "FeatureCollection"`)
  }

  rejectLegacyCrs(obj, context)
  if (obj.bbox != null) validateGeoJsonBbox(obj.bbox, `${context}.bbox`)

  if (!Array.isArray(obj.features)) {
    throw toProcessingError(`${context}: features должен быть массивом`)
  }

  obj.features.forEach((feature, index) => {
    validateGeoJsonFeature(feature, `${context}.features[${index}]`)
  })
}

/** Проверяет корневой GeoJSON object (RFC 7946, §2–3). */
export const validateGeoJsonObject = (value: unknown): void => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw toProcessingError('GeoJSON должен быть JSON-объектом')
  }

  const obj = value as { type?: string }
  if (typeof obj.type !== 'string' || !GEOJSON_ROOT_TYPES.has(obj.type)) {
    throw toProcessingError('GeoJSON type должен быть одним из типов RFC 7946 §1.4')
  }

  if (obj.type === 'Feature') {
    validateGeoJsonFeature(value)
    return
  }

  if (obj.type === 'FeatureCollection') {
    validateGeoJsonFeatureCollection(value)
    return
  }

  validateGeoJsonGeometry(value)
}

/** Нормализует Geometry в Feature для конвертера. */
export const normalizeGeoJsonRoot = (value: unknown): Feature | FeatureCollection => {
  validateGeoJsonObject(value)
  const obj = value as GeoJsonRoot

  if (obj.type === 'Feature') return obj
  if (obj.type === 'FeatureCollection') return obj

  return {
    type: 'Feature',
    geometry: obj,
    properties: null,
  }
}

/** Проверяет наличие конвертируемой геометрии. */
export const assertGeoJsonHasGeometry = (data: Feature | FeatureCollection): void => {
  const features = data.type === 'Feature' ? [data] : data.features
  const hasGeometry = features.some((feature) => {
    if (!feature.geometry) return false
    return extractPaths(feature.geometry).length > 0
  })

  if (!hasGeometry) {
    throw toProcessingError('GeoJSON не содержит геометрии для конвертации')
  }
}

/** Декодирует UTF-8 GeoJSON с удалением BOM (RFC 7946, §11.1). */
export const decodeUtf8GeoJsonText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  return new TextDecoder('utf-8').decode(hasBom ? bytes.subarray(3) : bytes)
}

/** Парсит и валидирует GeoJSON-текст по RFC 7946. */
export const parseAndValidateGeoJsonText = (text: string): Feature | FeatureCollection => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw toProcessingError(
      `Ошибка чтения GeoJSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const normalized = normalizeGeoJsonRoot(parsed)
  assertGeoJsonHasGeometry(normalized)
  return normalized
}

/** Парсит и валидирует GeoJSON из ArrayBuffer. */
export const parseAndValidateGeoJsonBuffer = (buffer: ArrayBuffer): Feature | FeatureCollection =>
  parseAndValidateGeoJsonText(decodeUtf8GeoJsonText(buffer))
