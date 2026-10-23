import type { Feature, FeatureCollection } from 'geojson'
import {
  readStringMember,
  rejectLegacyCrs,
  toProcessingError,
  validateOptionalBbox,
} from './geojson_coords'
import { validateGeoJsonGeometry } from './geojson_geometry_validator'

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
