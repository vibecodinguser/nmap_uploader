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
import { toProcessingError } from './wkt_keywords'

const ERR_FINITE_COORDINATE = 'недопустимое значение координаты (NaN или Infinity)'
const ERR_POSITION_MIN_XY = 'координатная пара должна содержать минимум X и Y'

export const isValidWktLatitude = (value: number): boolean => value >= -90 && value <= 90
export const isValidWktLongitude = (value: number): boolean => value >= -180 && value < 180

const assertFiniteCoordinate = (value: number, context: string): void => {
  if (Number.isFinite(value)) {
    return
  }
  throw toProcessingError(`${context}: ${ERR_FINITE_COORDINATE}`)
}

export const validatePosition = (position: Position, context: string): void => {
  if (position.length < 2) {
    throw toProcessingError(`${context}: ${ERR_POSITION_MIN_XY}`)
  }

  const x = Number(position[0])
  const y = Number(position[1])
  assertFiniteCoordinate(x, `${context}.X`)
  assertFiniteCoordinate(y, `${context}.Y`)

  if (!isValidWktLongitude(x)) {
    throw toProcessingError(`${context}: longitude ${x} вне диапазона [-180, 180)`)
  }
  if (!isValidWktLatitude(y)) {
    throw toProcessingError(`${context}: latitude ${y} вне диапазона [-90, 90]`)
  }
}

export const validatePositionList = (positions: Position[], context: string): void => {
  for (let index = 0; index < positions.length; index += 1) {
    validatePosition(positions[index], `${context}[${index}]`)
  }
}

const validatePolygonRings = (rings: Position[][], ringContextPrefix: string): void => {
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    validatePositionList(rings[ringIndex], `${ringContextPrefix}${ringIndex}`)
  }
}

const validatePointGeometry = (geom: Point, context: string): void => {
  validatePosition(geom.coordinates, context)
}

const validateLineStringGeometry = (geom: LineString, context: string): void => {
  validatePositionList(geom.coordinates, context)
}

const validateMultiPointGeometry = (geom: MultiPoint, context: string): void => {
  validatePositionList(geom.coordinates, context)
}

const validateMultiLineStringGeometry = (geom: MultiLineString, context: string): void => {
  const lines = geom.coordinates
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    validatePositionList(lines[lineIndex], `${context}.line${lineIndex}`)
  }
}

const validatePolygonGeometry = (geom: Polygon, context: string): void => {
  validatePolygonRings(geom.coordinates, `${context}.ring`)
}

const validateMultiPolygonGeometry = (geom: MultiPolygon, context: string): void => {
  const polygons = geom.coordinates
  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex += 1) {
    validatePolygonRings(polygons[polygonIndex], `${context}.polygon${polygonIndex}.ring`)
  }
}

const validateGeometryCollectionGeometry = (geom: GeometryCollection, context: string): void => {
  const parts = geom.geometries
  for (let index = 0; index < parts.length; index += 1) {
    validateGeometryCoordinates(parts[index], `${context}.part${index}`)
  }
}

const validateGeometryByType = (
  geometry: Geometry,
  geometryType: string,
  context: string,
): void => {
  switch (geometryType) {
    case 'Point':
      validatePointGeometry(geometry as Point, context)
      break
    case 'LineString':
      validateLineStringGeometry(geometry as LineString, context)
      break
    case 'Polygon':
      validatePolygonGeometry(geometry as Polygon, context)
      break
    case 'MultiPoint':
      validateMultiPointGeometry(geometry as MultiPoint, context)
      break
    case 'MultiLineString':
      validateMultiLineStringGeometry(geometry as MultiLineString, context)
      break
    case 'MultiPolygon':
      validateMultiPolygonGeometry(geometry as MultiPolygon, context)
      break
    case 'GeometryCollection':
      validateGeometryCollectionGeometry(geometry as GeometryCollection, context)
      break
  }
}

/** Проверяет координаты GeoJSON-геометрии после разбора WKT. */
export const validateGeometryCoordinates = (geometry: Geometry, context = 'WKT'): void => {
  validateGeometryByType(geometry, geometry.type, context)
}
