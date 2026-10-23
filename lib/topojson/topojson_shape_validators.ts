import { validateArcIndexArray } from './topojson_arcs'
import { toProcessingError, validateTopoJsonPosition } from './topojson_coords'
import type { TopoJsonGeometry } from './topojson_geometry_validator'

export type TopoJsonShapeValidator = (
  geom: TopoJsonGeometry,
  arcCount: number,
  isQuantized: boolean,
  context: string,
) => void

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

export const validatePointShape: TopoJsonShapeValidator = (
  geom,
  _arcCount,
  isQuantized,
  context,
) => {
  validateTopoJsonPosition(geom.coordinates, `${context}.coordinates`, isQuantized)
}

export const validateMultiPointShape: TopoJsonShapeValidator = (
  geom,
  _arcCount,
  isQuantized,
  context,
) => {
  validateMultiPointCoordinates(geom.coordinates, `${context}.coordinates`, isQuantized)
}

export const validateLineStringShape: TopoJsonShapeValidator = (
  geom,
  arcCount,
  _isQuantized,
  context,
) => {
  validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 1)
}

export const validateMultiLineStringShape: TopoJsonShapeValidator = (
  geom,
  arcCount,
  _isQuantized,
  context,
) => {
  validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 2)
}

export const validatePolygonShape: TopoJsonShapeValidator = (
  geom,
  arcCount,
  _isQuantized,
  context,
) => {
  validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 2)
}

export const validateMultiPolygonShape: TopoJsonShapeValidator = (
  geom,
  arcCount,
  _isQuantized,
  context,
) => {
  validateArcIndexArray(geom.arcs, arcCount, `${context}.arcs`, 3)
}
