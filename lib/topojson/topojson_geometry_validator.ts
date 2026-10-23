import { isPlainObject, toProcessingError, validateTopoJsonBbox } from './topojson_coords'
import {
  type TopoJsonShapeValidator,
  validateLineStringShape,
  validateMultiLineStringShape,
  validateMultiPointShape,
  validateMultiPolygonShape,
  validatePointShape,
  validatePolygonShape,
} from './topojson_shape_validators'

export * from './topojson_shape_validators'

export const TOPOJSON_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

export type TopoJsonGeometry = {
  type: string
  coordinates?: unknown
  arcs?: number[] | number[][] | number[][][]
  geometries?: TopoJsonGeometry[]
  properties?: unknown
  id?: string | number
  bbox?: unknown
}

const isKnownTopoJsonGeometryType = (type: unknown): type is string => {
  return typeof type === 'string' && TOPOJSON_GEOMETRY_TYPES.has(type)
}

const isValidTopoJsonProperties = (properties: unknown): boolean => {
  if (properties === null) {
    return true
  }
  return typeof properties === 'object' && !Array.isArray(properties)
}

const isValidTopoJsonId = (id: unknown): boolean => {
  return typeof id === 'string' || typeof id === 'number'
}

const assertValidTopoJsonProperties = (properties: unknown, context: string): void => {
  if (!isValidTopoJsonProperties(properties)) {
    throw toProcessingError(`${context}: properties должен быть объектом или null`)
  }
}

const assertValidTopoJsonId = (id: unknown, context: string): void => {
  if (!isValidTopoJsonId(id)) {
    throw toProcessingError(`${context}: id должен быть строкой или числом`)
  }
}

const validateTopoJsonGeometryProperties = (geometry: TopoJsonGeometry, context: string): void => {
  if ('properties' in geometry) {
    assertValidTopoJsonProperties(geometry.properties, context)
  }

  if ('id' in geometry) {
    assertValidTopoJsonId(geometry.id, context)
  }
}

const validateGeometryCollectionParts = (
  geometries: unknown,
  arcCount: number,
  isQuantized: boolean,
  context: string,
): void => {
  if (Array.isArray(geometries)) {
    for (let index = 0; index < geometries.length; index += 1) {
      validateTopoJsonGeometry(geometries[index], arcCount, isQuantized, `${context}[${index}]`)
    }
  } else {
    throw toProcessingError(`${context}: должен быть массивом`)
  }
}

const validateTopoJsonGeometryOptionalBbox = (bbox: unknown, context: string): void => {
  if (bbox != null) {
    validateTopoJsonBbox(bbox, `${context}.bbox`)
  }
}

const validateGeometryCollectionShape: TopoJsonShapeValidator = (
  geom,
  arcCount,
  isQuantized,
  context,
) => {
  validateGeometryCollectionParts(geom.geometries, arcCount, isQuantized, `${context}.geometries`)
}

const TOPO_JSON_SHAPE_VALIDATORS: Record<string, TopoJsonShapeValidator> = {
  Point: validatePointShape,
  MultiPoint: validateMultiPointShape,
  LineString: validateLineStringShape,
  MultiLineString: validateMultiLineStringShape,
  Polygon: validatePolygonShape,
  MultiPolygon: validateMultiPolygonShape,
  GeometryCollection: validateGeometryCollectionShape,
}

const validateTopoJsonGeometryShape = (
  geom: TopoJsonGeometry,
  arcCount: number,
  isQuantized: boolean,
  context: string,
): void => {
  const validateShape = TOPO_JSON_SHAPE_VALIDATORS[geom.type]
  if (validateShape) {
    validateShape(geom, arcCount, isQuantized, context)
  }
}

/** Проверяет geometry object (§2.2). */
export const validateTopoJsonGeometry = (
  geometry: unknown,
  arcCount: number,
  isQuantized: boolean,
  context = 'geometry',
): void => {
  if (isPlainObject(geometry)) {
    const geom = geometry as TopoJsonGeometry
    if (isKnownTopoJsonGeometryType(geom.type)) {
      validateTopoJsonGeometryProperties(geom, context)
      validateTopoJsonGeometryOptionalBbox(geom.bbox, context)
      validateTopoJsonGeometryShape(geom, arcCount, isQuantized, context)
    } else {
      throw toProcessingError(`${context}: недопустимый type геометрии TopoJSON`)
    }
  } else {
    throw toProcessingError(`${context}: geometry должен быть объектом`)
  }
}
