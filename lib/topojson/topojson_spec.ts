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

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

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
    return
  }

  if (!isValidGeoJsonLongitude(x)) {
    throw toProcessingError(`${context}[0]: longitude ${x} вне диапазона [-180, 180]`)
  }
  if (!isValidGeoJsonLatitude(y)) {
    throw toProcessingError(`${context}[1]: latitude ${y} вне диапазона [-90, 90]`)
  }
}

/** Проверяет transform (§2.1.2). */
export const validateTopoJsonTransform = (
  transform: unknown,
  context = 'transform',
): TopoJsonTransform => {
  if (!transform || typeof transform !== 'object') {
    throw toProcessingError(`${context}: transform должен быть объектом`)
  }

  const obj = transform as { scale?: unknown; translate?: unknown }
  if (!Array.isArray(obj.scale) || obj.scale.length !== 2) {
    throw toProcessingError(`${context}.scale: должен быть массивом из 2 чисел`)
  }
  if (!Array.isArray(obj.translate) || obj.translate.length !== 2) {
    throw toProcessingError(`${context}.translate: должен быть массивом из 2 чисел`)
  }

  const scale0 = Number(obj.scale[0])
  const scale1 = Number(obj.scale[1])
  const translate0 = Number(obj.translate[0])
  const translate1 = Number(obj.translate[1])
  assertFiniteNumber(scale0, `${context}.scale[0]`)
  assertFiniteNumber(scale1, `${context}.scale[1]`)
  assertFiniteNumber(translate0, `${context}.translate[0]`)
  assertFiniteNumber(translate1, `${context}.translate[1]`)

  return {
    scale: [scale0, scale1],
    translate: [translate0, translate1],
  }
}

/** Проверяет bbox: длина 2*n (§3). */
export const validateTopoJsonBbox = (bbox: unknown, context: string): void => {
  if (!Array.isArray(bbox)) {
    throw toProcessingError(`${context}: bbox должен быть массивом чисел`)
  }

  if (bbox.length !== 4 && bbox.length !== 6) {
    throw toProcessingError(`${context}: bbox должен содержать 4 или 6 чисел`)
  }

  bbox.forEach((value, index) => {
    assertFiniteNumber(Number(value), `${context}[${index}]`)
  })
}

/** Проверяет arc: массив из 2+ позиций (§2.1.3). */
export const validateTopoJsonArc = (arc: unknown, context: string, isQuantized: boolean): void => {
  if (!Array.isArray(arc)) {
    throw toProcessingError(`${context}: arc должен быть массивом позиций`)
  }

  if (arc.length < 2) {
    throw toProcessingError(`${context}: arc должен содержать минимум 2 позиции`)
  }

  arc.forEach((position, index) => {
    validateTopoJsonPosition(position, `${context}[${index}]`, isQuantized)
  })
}

/** Разрешает arc index, включая отрицательные (§2.1.4). */
export const resolveTopoJsonArcIndex = (index: number): number => (index < 0 ? ~index : index)

const validateArcIndexValue = (value: unknown, arcCount: number, context: string): void => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw toProcessingError(`${context}: arc index должен быть целым числом`)
  }

  const resolved = resolveTopoJsonArcIndex(value)
  if (resolved < 0 || resolved >= arcCount) {
    throw toProcessingError(
      `${context}: arc index ${value} вне диапазона [${-arcCount}, ${arcCount - 1}]`,
    )
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

  if (depth === 1) {
    value.forEach((index, i) => {
      validateArcIndexValue(index, arcCount, `${context}[${i}]`)
    })
    return
  }

  value.forEach((item, i) => {
    validateArcIndexArray(item, arcCount, `${context}[${i}]`, (depth - 1) as 1 | 2)
  })
}

const validateTopoJsonGeometryProperties = (geometry: TopoJsonGeometry, context: string): void => {
  if ('properties' in geometry) {
    const { properties } = geometry
    if (properties !== null && (typeof properties !== 'object' || Array.isArray(properties))) {
      throw toProcessingError(`${context}: properties должен быть объектом или null`)
    }
  }

  if ('id' in geometry) {
    const { id } = geometry
    if (typeof id !== 'string' && typeof id !== 'number') {
      throw toProcessingError(`${context}: id должен быть строкой или числом`)
    }
  }
}

/** Проверяет geometry object (§2.2). */
export const validateTopoJsonGeometry = (
  geometry: unknown,
  arcCount: number,
  isQuantized: boolean,
  context = 'geometry',
): void => {
  if (!geometry || typeof geometry !== 'object') {
    throw toProcessingError(`${context}: geometry должен быть объектом`)
  }

  const geom = geometry as TopoJsonGeometry
  if (typeof geom.type !== 'string' || !TOPOJSON_GEOMETRY_TYPES.has(geom.type)) {
    throw toProcessingError(`${context}: недопустимый type геометрии TopoJSON`)
  }

  validateTopoJsonGeometryProperties(geom, context)
  if (geom.bbox != null) validateTopoJsonBbox(geom.bbox, `${context}.bbox`)

  switch (geom.type) {
    case 'Point':
      validateTopoJsonPosition(geom.coordinates, `${context}.coordinates`, isQuantized)
      return
    case 'MultiPoint':
      if (!Array.isArray(geom.coordinates)) {
        throw toProcessingError(`${context}.coordinates: должен быть массивом позиций`)
      }
      ;(geom.coordinates as unknown[]).forEach((position: unknown, index: number) => {
        validateTopoJsonPosition(position, `${context}.coordinates[${index}]`, isQuantized)
      })
      return
    case 'LineString':
      validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 1)
      return
    case 'MultiLineString':
      validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 2)
      return
    case 'Polygon':
      validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 2)
      return
    case 'MultiPolygon':
      validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 3)
      return
    case 'GeometryCollection':
      if (!Array.isArray(geom.geometries)) {
        throw toProcessingError(`${context}.geometries: должен быть массивом`)
      }
      ;(geom.geometries as TopoJsonGeometry[]).forEach((part: TopoJsonGeometry, index: number) => {
        validateTopoJsonGeometry(part, arcCount, isQuantized, `${context}.geometries[${index}]`)
      })
  }
}

/** Проверяет Topology object (§2.1). */
export const validateTopoJsonTopology = (value: unknown): Topology => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw toProcessingError('TopoJSON должен быть JSON-объектом')
  }

  const topology = value as Topology & { bbox?: unknown }
  if (topology.type !== 'Topology') {
    throw toProcessingError('TopoJSON type должен быть "Topology"')
  }

  if (topology.bbox != null) validateTopoJsonBbox(topology.bbox, 'bbox')

  if (
    !topology.objects ||
    typeof topology.objects !== 'object' ||
    Array.isArray(topology.objects)
  ) {
    throw toProcessingError('Topology должен содержать член objects (§2.1)')
  }

  if (!Array.isArray(topology.arcs)) {
    throw toProcessingError('Topology должен содержать член arcs (§2.1)')
  }

  const isQuantized = topology.transform != null
  if (isQuantized) {
    validateTopoJsonTransform(topology.transform, 'transform')
  }

  topology.arcs.forEach((arc, index) => {
    validateTopoJsonArc(arc, `arcs[${index}]`, isQuantized)
  })

  const objectNames = Object.keys(topology.objects)
  if (objectNames.length === 0) {
    throw toProcessingError('TopoJSON objects не содержит геометрических объектов')
  }

  objectNames.forEach((objectName) => {
    validateTopoJsonGeometry(
      topology.objects[objectName],
      topology.arcs.length,
      isQuantized,
      `objects.${objectName}`,
    )
  })

  return topology
}

const toFeatureList = (value: Feature | FeatureCollection): Feature[] =>
  value.type === 'FeatureCollection' ? value.features : [value]

/** Проверяет наличие конвертируемой геометрии после topojson-client. */
export const assertTopoJsonHasConvertibleGeometry = (topology: Topology): void => {
  const objectNames = Object.keys(topology.objects ?? {})
  const hasGeometry = objectNames.some((objectName) => {
    const geoObject = feature(topology, topology.objects[objectName])
    return toFeatureList(geoObject).some((item) => {
      if (!item.geometry) return false
      return extractPaths(item.geometry).length > 0
    })
  })

  if (!hasGeometry) {
    throw toProcessingError('TopoJSON не содержит геометрии для конвертации')
  }
}

/** Декодирует UTF-8 TopoJSON с удалением BOM. */
export const decodeUtf8TopoJsonText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  return new TextDecoder('utf-8').decode(hasBom ? bytes.subarray(3) : bytes)
}

/** Парсит и валидирует TopoJSON-текст по спецификации. */
export const parseAndValidateTopoJsonText = (text: string): Topology => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw toProcessingError(
      `Ошибка чтения TopoJSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const topology = validateTopoJsonTopology(parsed)
  assertTopoJsonHasConvertibleGeometry(topology)
  return topology
}

/** Парсит и валидирует TopoJSON из ArrayBuffer. */
export const parseAndValidateTopoJsonBuffer = (buffer: ArrayBuffer): Topology =>
  parseAndValidateTopoJsonText(decodeUtf8TopoJsonText(buffer))
