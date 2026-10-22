import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { extractPaths } from '@/lib/geometry'
import {
  readStringMember,
  rejectLegacyCrs,
  toProcessingError,
  validateOptionalBbox,
} from './geojson_coords'
import { GEOJSON_GEOMETRY_TYPES, validateGeoJsonGeometry } from './geojson_geometry_validator'

export * from './geojson_coords'
export * from './geojson_geometry_validator'

/** Корневые типы GeoJSON (RFC 7946, §3). */
export const GEOJSON_ROOT_TYPES = new Set([
  ...GEOJSON_GEOMETRY_TYPES,
  'Feature',
  'FeatureCollection',
])

type GeoJsonRoot = Feature | FeatureCollection | Geometry

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
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
  if (feature.geometry) {
    const paths = extractPaths(feature.geometry)
    return paths.length > 0
  }
  return false
}

/** Проверяет наличие конвертируемой геометрии. */
export const assertGeoJsonHasGeometry = (data: Feature | FeatureCollection): void => {
  const features = data.type === 'Feature' ? [data] : data.features
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
  if (bytes.length >= 3) {
    return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  }
  return false
}

/** Декодирует UTF-8 GeoJSON с удалением BOM (RFC 7946, §11.1). */
export const decodeUtf8GeoJsonText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const payload = hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes
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
