import type { Feature, FeatureCollection } from 'geojson'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import { isValidGeoJsonLatitude, isValidGeoJsonLongitude } from '@/lib/geojson/geojson_spec'
import { extractPaths } from '@/lib/geometry'

/** Типы геометрии TopoJSON (§2.2) — регистрозависимые. */
export const TOPOJSON_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

type TopoJsonTransform = {
  scale: [number, number]
  translate: [number, number]
}

type TopoJsonGeometry = {
  type: string
  coordinates?: unknown
  arcs?: number[] | number[][] | number[][][]
  geometries?: TopoJsonGeometry[]
  properties?: unknown
  id?: string | number
  bbox?: unknown
}

const toProcessingError = (message: string): ProcessingError => {
  return new ProcessingError(ERR_SHAPEFILE, message)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  let result: boolean
  if (typeof value === 'object' && value !== null) {
    result = !Array.isArray(value)
  } else {
    result = false
  }

  return result
}

const isLength2Array = (value: unknown): value is [unknown, unknown] => {
  return Array.isArray(value) && value.length === 2
}

const isKnownTopoJsonGeometryType = (type: unknown): type is string => {
  return typeof type === 'string' && TOPOJSON_GEOMETRY_TYPES.has(type)
}

const isValidTopoJsonProperties = (properties: unknown): boolean => {
  let result: boolean
  if (properties === null) {
    result = true
  } else {
    result = typeof properties === 'object' && !Array.isArray(properties)
  }

  return result
}

const isValidTopoJsonId = (id: unknown): boolean => {
  return typeof id === 'string' || typeof id === 'number'
}

const assertFiniteNumber = (value: number, context: string): void => {
  if (!Number.isFinite(value)) {
    throw toProcessingError(`${context}: недопустимое число (NaN или Infinity)`)
  }
}

const assertInteger32 = (value: number, context: string): void => {
  if (!Number.isInteger(value)) {
    throw toProcessingError(`${context}: квантованная позиция должна быть целым числом`)
  }

  if (value < -2147483648 || value > 2147483647) {
    throw toProcessingError(`${context}: целое число вне диапазона 32-bit signed integer`)
  }
}

/** Проверяет position: минимум 2 числа (§2.1.1). */
export const validateTopoJsonPosition = (
  position: unknown,
  context: string,
  isQuantized: boolean,
): void => {
  if (!Array.isArray(position)) {
    throw toProcessingError(`${context}: position должна быть массивом чисел`)
  }

  if (position.length < 2) {
    throw toProcessingError(`${context}: position должна содержать минимум 2 элемента`)
  }

  const x = Number(position[0])
  const y = Number(position[1])
  assertFiniteNumber(x, `${context}[0]`)
  assertFiniteNumber(y, `${context}[1]`)

  if (isQuantized) {
    assertInteger32(x, `${context}[0]`)
    assertInteger32(y, `${context}[1]`)
  } else {
    if (!isValidGeoJsonLongitude(x)) {
      throw toProcessingError(`${context}[0]: longitude ${x} вне диапазона [-180, 180]`)
    }
    if (!isValidGeoJsonLatitude(y)) {
      throw toProcessingError(`${context}[1]: latitude ${y} вне диапазона [-90, 90]`)
    }
  }
}

/** Проверяет transform (§2.1.2). */
export const validateTopoJsonTransform = (
  transform: unknown,
  context = 'transform',
): TopoJsonTransform => {
  let result: TopoJsonTransform | undefined

  if (isPlainObject(transform)) {
    const obj = transform as { scale?: unknown; translate?: unknown }

    if (isLength2Array(obj.scale)) {
      if (isLength2Array(obj.translate)) {
        const scaleX = Number(obj.scale[0])
        const scaleY = Number(obj.scale[1])
        const translateX = Number(obj.translate[0])
        const translateY = Number(obj.translate[1])
        assertFiniteNumber(scaleX, `${context}.scale[0]`)
        assertFiniteNumber(scaleY, `${context}.scale[1]`)
        assertFiniteNumber(translateX, `${context}.translate[0]`)
        assertFiniteNumber(translateY, `${context}.translate[1]`)

        result = {
          scale: [scaleX, scaleY],
          translate: [translateX, translateY],
        }
      } else {
        throw toProcessingError(`${context}.translate: должен быть массивом из 2 чисел`)
      }
    } else {
      throw toProcessingError(`${context}.scale: должен быть массивом из 2 чисел`)
    }
  } else {
    throw toProcessingError(`${context}: transform должен быть объектом`)
  }

  return result
}

const isValidTopoJsonBboxLength = (length: number): boolean => {
  return length === 4 || length === 6
}

/** Проверяет bbox: длина 2*n (§3). */
export const validateTopoJsonBbox = (bbox: unknown, context: string): void => {
  if (!Array.isArray(bbox)) {
    throw toProcessingError(`${context}: bbox должен быть массивом чисел`)
  }

  if (!isValidTopoJsonBboxLength(bbox.length)) {
    throw toProcessingError(`${context}: bbox должен содержать 4 или 6 чисел`)
  }

  for (let index = 0; index < bbox.length; index += 1) {
    const numericValue = Number(bbox[index])
    assertFiniteNumber(numericValue, `${context}[${index}]`)
  }
}

/** Проверяет arc: массив из 2+ позиций (§2.1.3). */
export const validateTopoJsonArc = (arc: unknown, context: string, isQuantized: boolean): void => {
  if (!Array.isArray(arc)) {
    throw toProcessingError(`${context}: arc должен быть массивом позиций`)
  }

  if (arc.length < 2) {
    throw toProcessingError(`${context}: arc должен содержать минимум 2 позиции`)
  }

  for (let index = 0; index < arc.length; index += 1) {
    validateTopoJsonPosition(arc[index], `${context}[${index}]`, isQuantized)
  }
}

/** Разрешает arc index, включая отрицательные (§2.1.4). */
export const resolveTopoJsonArcIndex = (index: number): number => {
  let resolved = index
  if (index < 0) {
    resolved = ~index
  }

  return resolved
}

const validateArcIndexValue = (value: unknown, arcCount: number, context: string): void => {
  if (typeof value !== 'number') {
    throw toProcessingError(`${context}: arc index должен быть целым числом`)
  }

  if (!Number.isInteger(value)) {
    throw toProcessingError(`${context}: arc index должен быть целым числом`)
  }

  const resolved = resolveTopoJsonArcIndex(value)
  if (resolved < 0) {
    throw toProcessingError(
      `${context}: arc index ${value} вне диапазона [${-arcCount}, ${arcCount - 1}]`,
    )
  }

  if (resolved >= arcCount) {
    throw toProcessingError(
      `${context}: arc index ${value} вне диапазона [${-arcCount}, ${arcCount - 1}]`,
    )
  }
}

const validateArcIndexAtDepth = (
  item: unknown,
  arcCount: number,
  context: string,
  depth: 1 | 2 | 3,
): void => {
  if (depth === 1) {
    validateArcIndexValue(item, arcCount, context)
  } else {
    validateArcIndexArray(item, arcCount, context, (depth - 1) as 1 | 2)
  }
}

const validateArcIndexArray = (
  value: unknown,
  arcCount: number,
  context: string,
  depth: 1 | 2 | 3,
): void => {
  if (!Array.isArray(value)) {
    throw toProcessingError(`${context}: arcs должен быть массивом`)
  }

  for (let index = 0; index < value.length; index += 1) {
    validateArcIndexAtDepth(value[index], arcCount, `${context}[${index}]`, depth)
  }
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

const validateMultiPointCoordinates = (
  coordinates: unknown,
  context: string,
  isQuantized: boolean,
): void => {
  if (Array.isArray(coordinates)) {
    for (let index = 0; index < coordinates.length; index += 1) {
      validateTopoJsonPosition(coordinates[index], `${context}[${index}]`, isQuantized)
    }
  } else {
    throw toProcessingError(`${context}: должен быть массивом позиций`)
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

type TopoJsonShapeValidator = (
  geom: TopoJsonGeometry,
  arcCount: number,
  isQuantized: boolean,
  context: string,
) => void

const validatePointShape: TopoJsonShapeValidator = (geom, _arcCount, isQuantized, context) => {
  validateTopoJsonPosition(geom.coordinates, `${context}.coordinates`, isQuantized)
}

const validateMultiPointShape: TopoJsonShapeValidator = (geom, _arcCount, isQuantized, context) => {
  validateMultiPointCoordinates(geom.coordinates, `${context}.coordinates`, isQuantized)
}

const validateLineStringShape: TopoJsonShapeValidator = (geom, arcCount, _isQuantized, context) => {
  validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 1)
}

const validateMultiLineStringShape: TopoJsonShapeValidator = (
  geom,
  arcCount,
  _isQuantized,
  context,
) => {
  validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 2)
}

const validatePolygonShape: TopoJsonShapeValidator = (geom, arcCount, _isQuantized, context) => {
  validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 2)
}

const validateMultiPolygonShape: TopoJsonShapeValidator = (
  geom,
  arcCount,
  _isQuantized,
  context,
) => {
  validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 3)
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

const assertTopoJsonRootObject = (value: unknown): Record<string, unknown> => {
  let root: Record<string, unknown> | undefined
  if (isPlainObject(value)) {
    root = value
  }

  if (root) {
    return root
  }

  throw toProcessingError('TopoJSON должен быть JSON-объектом')
}

const assertTopologyType = (type: unknown): void => {
  if (type !== 'Topology') {
    throw toProcessingError('TopoJSON type должен быть "Topology"')
  }
}

const assertTopologyObjects = (objects: unknown): Record<string, unknown> => {
  let result: Record<string, unknown> | undefined
  if (isPlainObject(objects)) {
    result = objects
  }

  if (result) {
    return result
  }

  throw toProcessingError('Topology должен содержать член objects (§2.1)')
}

const assertTopologyArcs = (arcs: unknown): unknown[] => {
  let result: unknown[] | undefined
  if (Array.isArray(arcs)) {
    result = arcs
  }

  if (result) {
    return result
  }

  throw toProcessingError('Topology должен содержать член arcs (§2.1)')
}

const validateTopologyOptionalBbox = (bbox: unknown): void => {
  if (bbox != null) {
    validateTopoJsonBbox(bbox, 'bbox')
  }
}

const validateTopologyTransformIfPresent = (transform: unknown): boolean => {
  const isQuantized = transform != null
  if (isQuantized) {
    validateTopoJsonTransform(transform, 'transform')
  }

  return isQuantized
}

const validateTopologyArcsList = (arcs: unknown[], isQuantized: boolean): void => {
  for (let index = 0; index < arcs.length; index += 1) {
    validateTopoJsonArc(arcs[index], `arcs[${index}]`, isQuantized)
  }
}

const validateTopologyObjectGeometries = (
  objects: Record<string, unknown>,
  arcCount: number,
  isQuantized: boolean,
): void => {
  const objectNames = Object.keys(objects)
  if (objectNames.length === 0) {
    throw toProcessingError('TopoJSON objects не содержит геометрических объектов')
  }

  for (let index = 0; index < objectNames.length; index += 1) {
    const objectName = objectNames[index]
    validateTopoJsonGeometry(objects[objectName], arcCount, isQuantized, `objects.${objectName}`)
  }
}

/** Проверяет Topology object (§2.1). */
export const validateTopoJsonTopology = (value: unknown): Topology => {
  const root = assertTopoJsonRootObject(value)
  const topology = root as unknown as Topology & { bbox?: unknown }

  assertTopologyType(topology.type)
  validateTopologyOptionalBbox(topology.bbox)

  const objects = assertTopologyObjects(topology.objects)
  const arcs = assertTopologyArcs(topology.arcs)
  const isQuantized = validateTopologyTransformIfPresent(topology.transform)

  validateTopologyArcsList(arcs, isQuantized)
  validateTopologyObjectGeometries(objects, arcs.length, isQuantized)

  return topology
}

const toFeatureList = (value: Feature | FeatureCollection): Feature[] => {
  let features: Feature[]
  if (value.type === 'FeatureCollection') {
    features = value.features
  } else {
    features = [value]
  }

  return features
}

const featureHasConvertibleGeometry = (item: Feature): boolean => {
  let hasGeometry = false
  if (item.geometry) {
    hasGeometry = extractPaths(item.geometry).length > 0
  }

  return hasGeometry
}

const featureListHasConvertibleGeometry = (features: Feature[]): boolean => {
  return features.some(featureHasConvertibleGeometry)
}

const objectHasConvertibleGeometry = (topology: Topology, objectName: string): boolean => {
  const geoObject = feature(topology, topology.objects[objectName])
  const features = toFeatureList(geoObject)
  return featureListHasConvertibleGeometry(features)
}

/** Проверяет наличие конвертируемой геометрии после topojson-client. */
export const assertTopoJsonHasConvertibleGeometry = (topology: Topology): void => {
  let objects: Topology['objects']
  if (topology.objects == null) {
    objects = {}
  } else {
    objects = topology.objects
  }

  const objectNames = Object.keys(objects)
  let hasGeometry = false
  for (const objectName of objectNames) {
    if (objectHasConvertibleGeometry(topology, objectName)) {
      hasGeometry = true
    }
  }

  if (!hasGeometry) {
    throw toProcessingError('TopoJSON не содержит геометрии для конвертации')
  }
}

const hasUtf8Bom = (bytes: Uint8Array): boolean => {
  let result: boolean
  if (bytes.length >= 3) {
    const isFirstByte = bytes[0] === 0xef
    const isSecondByte = bytes[1] === 0xbb
    const isThirdByte = bytes[2] === 0xbf
    result = isFirstByte && isSecondByte && isThirdByte
  } else {
    result = false
  }

  return result
}

/** Декодирует UTF-8 TopoJSON с удалением BOM. */
export const decodeUtf8TopoJsonText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const hasBom = hasUtf8Bom(bytes)
  let payload: Uint8Array
  if (hasBom) {
    payload = bytes.subarray(3)
  } else {
    payload = bytes
  }

  const decoder = new TextDecoder('utf-8')
  return decoder.decode(payload)
}

const getErrorMessage = (error: unknown): string => {
  let message: string
  if (error instanceof Error) {
    message = error.message
  } else {
    message = String(error)
  }

  return message
}

/** Парсит и валидирует TopoJSON-текст по спецификации. */
export const parseAndValidateTopoJsonText = (text: string): Topology => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const message = getErrorMessage(error)
    throw toProcessingError(`Ошибка чтения TopoJSON: ${message}`)
  }

  const topology = validateTopoJsonTopology(parsed)
  assertTopoJsonHasConvertibleGeometry(topology)
  return topology
}

/** Парсит и валидирует TopoJSON из ArrayBuffer. */
export const parseAndValidateTopoJsonBuffer = (buffer: ArrayBuffer): Topology => {
  const text = decodeUtf8TopoJsonText(buffer)
  return parseAndValidateTopoJsonText(text)
}
