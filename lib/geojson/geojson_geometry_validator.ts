import type {
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
import {
  readStringMember,
  rejectLegacyCrs,
  toProcessingError,
  validateGeoJsonPosition,
  validateOptionalBbox,
  validatePositionList,
} from './geojson_coords'

export const GEOJSON_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

export const validateLinearRing = (ring: unknown, context: string): void => {
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
