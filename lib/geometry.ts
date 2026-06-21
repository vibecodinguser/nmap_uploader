import type { Geometry, Position } from 'geojson'
import type { NmapIndex } from './nmap_index'

const MIN_POLYGON_POINTS = 3
const AREA_TOLERANCE = 0.0000000001

const arePointsEqual = (p1: number[], p2: number[]): boolean => {
  return p1[0] === p2[0] && p1[1] === p2[1]
}

/** Удаляет последовательные дубликаты координат. */
export const validateDuplicate = (coords: Position[], closeRing = false): number[][] => {
  let result: number[][] = []
  if (coords.length) {
    const cleaned: number[][] = [[Number(coords[0][0]), Number(coords[0][1])]]
    for (let i = 1; i < coords.length; i += 1) {
      const current = [Number(coords[i][0]), Number(coords[i][1])]
      const last = cleaned[cleaned.length - 1]
      if (!arePointsEqual(current, last)) {
        cleaned.push(current)
      }
    }

    if (closeRing && cleaned.length >= MIN_POLYGON_POINTS) {
      const first = cleaned[0]
      const last = cleaned[cleaned.length - 1]
      if (!arePointsEqual(first, last)) {
        cleaned.push([...first])
      }
    }
    result = cleaned
  }
  return result
}

const polygonCentroid = (coords: number[][]): [number, number] => {
  let area = 0
  let cx = 0
  let cy = 0
  let result: [number, number]

  for (let i = 0; i < coords.length - 1; i += 1) {
    const cross = coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1]
    area += cross
    cx += (coords[i][0] + coords[i + 1][0]) * cross
    cy += (coords[i][1] + coords[i + 1][1]) * cross
  }

  area *= 0.5
  if (Math.abs(area) < AREA_TOLERANCE) {
    result = [coords[0][0], coords[0][1]]
  } else {
    result = [cx / (6 * area), cy / (6 * area)]
  }

  return result
}

export const getPointForGeometry = (
  geomType: string,
  pathCoords: number[][],
): [number, number] | null => {
  let point: [number, number] | null = null

  if (pathCoords.length) {
    if (
      ('Polygon' === geomType || 'MultiPolygon' === geomType) &&
      pathCoords.length >= MIN_POLYGON_POINTS
    ) {
      try {
        point = polygonCentroid(pathCoords)
      } catch {
        point = [pathCoords[0][0], pathCoords[0][1]]
      }
    } else {
      point = [pathCoords[0][0], pathCoords[0][1]]
    }
  }

  return point
}

const validateLine = (line: Position[]) => validateDuplicate(line)
const validateRing = (ring: Position[]) => validateDuplicate(ring, true)
const validatePolygon = (polygon: Position[][]) => polygon.map(validateRing)
const convertPointToPath = (point: Position) => [[point[0], point[1]]]

const extractPathsFromSingleGeom = (geom: Geometry): number[][][] => {
  let paths: number[][][]
  switch (geom.type) {
    case 'Point':
      paths = [[[geom.coordinates[0], geom.coordinates[1]]]]
      break
    case 'LineString':
      paths = [validateDuplicate(geom.coordinates)]
      break
    case 'MultiLineString':
      paths = geom.coordinates.map(validateLine)
      break
    case 'Polygon':
      paths = geom.coordinates.map(validateRing)
      break
    case 'MultiPolygon':
      paths = geom.coordinates.flatMap(validatePolygon)
      break
    case 'MultiPoint':
      paths = geom.coordinates.map(convertPointToPath)
      break
    case 'GeometryCollection':
      paths = geom.geometries.flatMap(extractPathsFromSingleGeom)
      break
    default:
      paths = []
      break
  }
  return paths
}

export const extractPaths = (geom: Geometry): number[][][] => {
  return extractPathsFromSingleGeom(geom)
}

export const addFeatureToOutput = ({
  output,
  geom,
  featurePaths,
  description,
}: {
  output: NmapIndex
  geom: Geometry
  featurePaths: number[][][]
  description: string
}): void => {
  for (const pathCoords of featurePaths) {
    if (pathCoords.length) {
      const sharedUuid = crypto.randomUUID()
      output.paths[sharedUuid] = pathCoords

      const pointCoords = getPointForGeometry(geom.type, pathCoords)
      if (pointCoords) {
        output.points[sharedUuid] = {
          coords: pointCoords,
          desc: description,
        }
      }
    }
  }
}
