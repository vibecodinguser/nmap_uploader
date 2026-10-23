import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { extractPaths } from '@/lib/geometry'
import { readStringMember, toProcessingError } from './geojson_coords'
import {
  validateGeoJsonFeature,
  validateGeoJsonFeatureCollection,
} from './geojson_feature_validator'
import { GEOJSON_GEOMETRY_TYPES, validateGeoJsonGeometry } from './geojson_geometry_validator'

export * from './geojson_coords'
export * from './geojson_feature_validator'
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
