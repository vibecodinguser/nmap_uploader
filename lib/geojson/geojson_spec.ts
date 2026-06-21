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

const getErrorMessage = (error: unknown): string => {
  let message: string

  if (error instanceof Error) {
    message = error.message
  } else {
    message = String(error)
  }

  return message
}

const readStringMember = (value: object, key: string, context: string): string => {
  const record = value as Record<string, unknown>
  const member = record[key]

  if (typeof member !== 'string') {
    throw toProcessingError(`${context}: недопустимый type; ожидается строка RFC 7946 §1.4`)
  }

  return member
}

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
    const altitude = Number(position[2])
    assertFiniteNumber(altitude, `${context}.altitude`)
  }
}

const validatePositionList = (positions: unknown, context: string): void => {
  if (!Array.isArray(positions)) {
    throw toProcessingError(`${context}: coordinates должны быть массивом позиций`)
  }

  for (let index = 0; index < positions.length; index += 1) {
    validateGeoJsonPosition(positions[index], `${context}[${index}]`)
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

  validatePositionList(ring, context)

  const first = ring[0] as Position
  const last = ring[ring.length - 1] as Position
  const firstLon = first[0]
  const lastLon = last[0]
  const firstLat = first[1]
  const lastLat = last[1]
  const ringIsClosed = firstLon === lastLon && firstLat === lastLat

  if (!ringIsClosed) {
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

  for (let index = 0; index < bbox.length; index += 1) {
    const value = bbox[index]
    const numericValue = Number(value)
    assertFiniteNumber(numericValue, `${context}[${index}]`)
  }
}

const validateOptionalBbox = (bbox: unknown, context: string): void => {
  if (bbox != null) {
    validateGeoJsonBbox(bbox, context)
  }
}

const validatePointGeometry = (geom: Point, context: string): void => {
  validateGeoJsonPosition(geom.coordinates, `${context}.coordinates`)
}

const validateMultiPointGeometry = (geom: MultiPoint, context: string): void => {
  validatePositionList(geom.coordinates, `${context}.coordinates`)
}

const validateLineStringGeometry = (geom: LineString, context: string): void => {
  const coordinates = geom.coordinates

  if (coordinates.length < 2) {
    throw toProcessingError(
      `${context}: LineString должен содержать минимум 2 позиции (RFC 7946, §3.1.4)`,
    )
  }

  validatePositionList(coordinates, `${context}.coordinates`)
}

const validateMultiLineStringGeometry = (geom: MultiLineString, context: string): void => {
  const lines = geom.coordinates

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]

    if (line.length < 2) {
      throw toProcessingError(
        `${context}.coordinates[${lineIndex}]: LineString должен содержать минимум 2 позиции`,
      )
    }

    validatePositionList(line, `${context}.coordinates[${lineIndex}]`)
  }
}

const validatePolygonRings = (rings: Position[][], ringContextPrefix: string): void => {
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    validateLinearRing(rings[ringIndex], `${ringContextPrefix}[${ringIndex}]`)
  }
}

const validatePolygonGeometry = (geom: Polygon, context: string): void => {
  validatePolygonRings(geom.coordinates, `${context}.coordinates`)
}

const validateMultiPolygonGeometry = (geom: MultiPolygon, context: string): void => {
  const polygons = geom.coordinates

  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex += 1) {
    validatePolygonRings(polygons[polygonIndex], `${context}.coordinates[${polygonIndex}]`)
  }
}

const validateGeometryCollectionGeometry = (geom: GeometryCollection, context: string): void => {
  const parts = geom.geometries

  if (!Array.isArray(parts)) {
    throw toProcessingError(`${context}: GeometryCollection.geometries должен быть массивом`)
  }

  for (let index = 0; index < parts.length; index += 1) {
    validateGeoJsonGeometry(parts[index], `${context}.geometries[${index}]`)
  }
}

const validateGeometryByType = (geom: Geometry, geometryType: string, context: string): void => {
  switch (geometryType) {
    case 'Point':
      validatePointGeometry(geom as Point, context)
      break
    case 'MultiPoint':
      validateMultiPointGeometry(geom as MultiPoint, context)
      break
    case 'LineString':
      validateLineStringGeometry(geom as LineString, context)
      break
    case 'MultiLineString':
      validateMultiLineStringGeometry(geom as MultiLineString, context)
      break
    case 'Polygon':
      validatePolygonGeometry(geom as Polygon, context)
      break
    case 'MultiPolygon':
      validateMultiPolygonGeometry(geom as MultiPolygon, context)
      break
    case 'GeometryCollection':
      validateGeometryCollectionGeometry(geom as GeometryCollection, context)
      break
    default:
      throw toProcessingError(
        `${context}: недопустимый type геометрии; ожидается один из RFC 7946 §1.4`,
      )
  }
}

/** Проверяет Geometry object (RFC 7946, §3.1). */
export const validateGeoJsonGeometry = (geometry: unknown, context = 'geometry'): void => {
  if (!geometry || typeof geometry !== 'object') {
    throw toProcessingError(`${context}: geometry должна быть объектом`)
  }

  const geom = geometry as Geometry & { bbox?: unknown }
  const geometryType = readStringMember(geometry, 'type', context)

  if (!GEOJSON_GEOMETRY_TYPES.has(geometryType)) {
    throw toProcessingError(
      `${context}: недопустимый type геометрии; ожидается один из RFC 7946 §1.4`,
    )
  }

  rejectLegacyCrs(geom, context)
  validateOptionalBbox(geom.bbox, `${context}.bbox`)
  validateGeometryByType(geom, geometryType, context)
}

const validateFeatureProperties = (properties: unknown, context: string): void => {
  if (properties !== null) {
    if (typeof properties === 'object') {
      if (Array.isArray(properties)) {
        throw toProcessingError(`${context}: properties должен быть объектом или null`)
      }
    } else {
      throw toProcessingError(`${context}: properties должен быть объектом или null`)
    }
  }
}

/** Проверяет Feature (RFC 7946, §3.2). */
export const validateGeoJsonFeature = (feature: unknown, context = 'Feature'): void => {
  if (feature && typeof feature === 'object') {
    const obj = feature as Feature & { bbox?: unknown }
    const featureType = readStringMember(feature, 'type', context)

    if (featureType === 'Feature') {
      rejectLegacyCrs(obj, context)
      validateOptionalBbox(obj.bbox, `${context}.bbox`)

      if ('properties' in obj) {
        validateFeatureProperties(obj.properties, context)

        if ('geometry' in obj) {
          if (obj.geometry !== null) {
            validateGeoJsonGeometry(obj.geometry, `${context}.geometry`)
          }
        } else {
          throw toProcessingError(
            `${context}: Feature должен содержать член geometry (RFC 7946, §3.2)`,
          )
        }
      } else {
        throw toProcessingError(
          `${context}: Feature должен содержать член properties (RFC 7946, §3.2)`,
        )
      }
    } else {
      throw toProcessingError(`${context}: type должен быть "Feature"`)
    }
  } else {
    throw toProcessingError(`${context}: Feature должен быть объектом`)
  }
}

/** Проверяет FeatureCollection (RFC 7946, §3.3). */
export const validateGeoJsonFeatureCollection = (
  collection: unknown,
  context = 'FeatureCollection',
): void => {
  if (collection && typeof collection === 'object') {
    const obj = collection as FeatureCollection & { bbox?: unknown }
    const collectionType = readStringMember(collection, 'type', context)

    if (collectionType === 'FeatureCollection') {
      rejectLegacyCrs(obj, context)
      validateOptionalBbox(obj.bbox, `${context}.bbox`)

      if (Array.isArray(obj.features)) {
        for (let index = 0; index < obj.features.length; index += 1) {
          validateGeoJsonFeature(obj.features[index], `${context}.features[${index}]`)
        }
        return
      }

      throw toProcessingError(`${context}: features должен быть массивом`)
    }

    throw toProcessingError(`${context}: type должен быть "FeatureCollection"`)
  }

  throw toProcessingError(`${context}: FeatureCollection должен быть объектом`)
}

/** Проверяет корневой GeoJSON object (RFC 7946, §2–3). */
export const validateGeoJsonObject = (value: unknown): void => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw toProcessingError('GeoJSON должен быть JSON-объектом')
  }

  const rootType = readStringMember(value, 'type', 'GeoJSON')

  if (!GEOJSON_ROOT_TYPES.has(rootType)) {
    throw toProcessingError('GeoJSON type должен быть одним из типов RFC 7946 §1.4')
  }

  if (rootType === 'Feature') {
    validateGeoJsonFeature(value)
  } else if (rootType === 'FeatureCollection') {
    validateGeoJsonFeatureCollection(value)
  } else {
    validateGeoJsonGeometry(value)
  }
}

/** Нормализует Geometry в Feature для конвертера. */
export const normalizeGeoJsonRoot = (value: unknown): Feature | FeatureCollection => {
  validateGeoJsonObject(value)
  const obj = value as GeoJsonRoot
  let normalized: Feature | FeatureCollection

  if (obj.type === 'Feature') {
    normalized = obj
  } else if (obj.type === 'FeatureCollection') {
    normalized = obj
  } else {
    normalized = {
      type: 'Feature',
      geometry: obj,
      properties: null,
    }
  }

  return normalized
}

const featureHasGeometry = (feature: Feature): boolean => {
  let hasPaths = false

  if (feature.geometry) {
    const paths = extractPaths(feature.geometry)
    if (paths.length > 0) {
      hasPaths = true
    }
  }

  return hasPaths
}

/** Проверяет наличие конвертируемой геометрии. */
export const assertGeoJsonHasGeometry = (data: Feature | FeatureCollection): void => {
  let features: Feature[]

  if (data.type === 'Feature') {
    features = [data]
  } else {
    features = data.features
  }

  let hasGeometry = false

  for (const feature of features) {
    if (featureHasGeometry(feature)) {
      hasGeometry = true
    }
  }

  if (!hasGeometry) {
    throw toProcessingError('GeoJSON не содержит геометрии для конвертации')
  }
}

const hasUtf8Bom = (bytes: Uint8Array): boolean => {
  let result = false

  if (bytes.length >= 3) {
    const hasFirstByte = bytes[0] === 0xef
    const hasSecondByte = bytes[1] === 0xbb
    const hasThirdByte = bytes[2] === 0xbf

    if (hasFirstByte && hasSecondByte && hasThirdByte) {
      result = true
    }
  }

  return result
}

/** Декодирует UTF-8 GeoJSON с удалением BOM (RFC 7946, §11.1). */
export const decodeUtf8GeoJsonText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let payload = bytes

  if (hasUtf8Bom(bytes)) {
    payload = bytes.subarray(3)
  }

  const decoder = new TextDecoder('utf-8')
  return decoder.decode(payload)
}

/** Парсит и валидирует GeoJSON-текст по RFC 7946. */
export const parseAndValidateGeoJsonText = (text: string): Feature | FeatureCollection => {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    throw toProcessingError(`Ошибка чтения GeoJSON: ${errorMessage}`)
  }

  const normalized = normalizeGeoJsonRoot(parsed)
  assertGeoJsonHasGeometry(normalized)
  return normalized
}

/** Парсит и валидирует GeoJSON из ArrayBuffer. */
export const parseAndValidateGeoJsonBuffer = (buffer: ArrayBuffer): Feature | FeatureCollection => {
  const text = decodeUtf8GeoJsonText(buffer)
  return parseAndValidateGeoJsonText(text)
}
