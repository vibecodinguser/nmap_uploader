import type { Topology } from 'topojson-specification'
import { validateTopoJsonArc } from './topojson_arcs'
import {
  isPlainObject,
  toProcessingError,
  validateTopoJsonBbox,
  validateTopoJsonTransform,
} from './topojson_coords'
import { validateTopoJsonGeometry } from './topojson_geometry_validator'

const assertTopoJsonRootObject = (value: unknown): Record<string, unknown> => {
  if (isPlainObject(value)) {
    return value
  }
  throw toProcessingError('TopoJSON должен быть JSON-объектом')
}

const assertTopologyType = (type: unknown): void => {
  if (type !== 'Topology') {
    throw toProcessingError('TopoJSON type должен быть "Topology"')
  }
}

const assertTopologyObjects = (objects: unknown): Record<string, unknown> => {
  if (isPlainObject(objects)) {
    return objects
  }
  throw toProcessingError('Topology должен содержать член objects (§2.1)')
}

const assertTopologyArcs = (arcs: unknown): unknown[] => {
  if (Array.isArray(arcs)) {
    return arcs
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
