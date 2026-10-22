import type { Feature, FeatureCollection } from 'geojson'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { extractPaths } from '@/lib/geometry'
import { toProcessingError } from './topojson_coords'
import { validateTopoJsonTopology } from './topojson_topology_validator'

export * from './topojson_arcs'
export * from './topojson_coords'
export * from './topojson_geometry_validator'
export * from './topojson_topology_validator'

const toFeatureList = (value: Feature | FeatureCollection): Feature[] => {
  if (value.type === 'FeatureCollection') {
    return value.features
  }
  return [value]
}

const featureHasConvertibleGeometry = (item: Feature): boolean => {
  if (item.geometry) {
    return extractPaths(item.geometry).length > 0
  }
  return false
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
  const objects = topology.objects ?? {}
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
  if (bytes.length >= 3) {
    return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  }
  return false
}

/** Декодирует UTF-8 TopoJSON с удалением BOM. */
export const decodeUtf8TopoJsonText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const payload = hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes
  const decoder = new TextDecoder('utf-8')
  return decoder.decode(payload)
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
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
