import type { Geometry, Position } from 'geojson'
import type { NmapIndex } from './nmap_index'

const MIN_POLYGON_POINTS = 3

/** Удаляет последовательные дубликаты координат. */
export const validateDuplicate = (coords: Position[], closeRing = false): number[][] => {
  if (coords.length === 0) return []

  const cleaned: number[][] = [[Number(coords[0][0]), Number(coords[0][1])]]
  for (let i = 1; i < coords.length; i += 1) {
    const current = [Number(coords[i][0]), Number(coords[i][1])]
    const last = cleaned[cleaned.length - 1]
    if (current[0] !== last[0] || current[1] !== last[1]) {
      cleaned.push(current)
    }
  }

  if (closeRing && cleaned.length >= MIN_POLYGON_POINTS) {
    const first = cleaned[0]
    const last = cleaned[cleaned.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      cleaned.push([...first])
    }
  }

  return cleaned
}

const polygonCentroid = (coords: number[][]): [number, number] => {
  let area = 0
  let cx = 0
  let cy = 0

  for (let i = 0; i < coords.length - 1; i += 1) {
    const cross = coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1]
    area += cross
    cx += (coords[i][0] + coords[i + 1][0]) * cross
    cy += (coords[i][1] + coords[i + 1][1]) * cross
  }

  area *= 0.5
  if (Math.abs(area) < 1e-10) {
    return [coords[0][0], coords[0][1]]
  }

  return [cx / (6 * area), cy / (6 * area)]
}

export const getPointForGeometry = (
  geomType: string,
  pathCoords: number[][],
): [number, number] | null => {
  if (pathCoords.length === 0) return null

  if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
    if (pathCoords.length >= MIN_POLYGON_POINTS) {
      try {
        return polygonCentroid(pathCoords)
      } catch {
        return [pathCoords[0][0], pathCoords[0][1]]
      }
    }
  }

  return [pathCoords[0][0], pathCoords[0][1]]
}

const extractPathsFromSingleGeom = (geom: Geometry): number[][][] => {
  switch (geom.type) {
    case 'Point':
      return [[[geom.coordinates[0], geom.coordinates[1]]]]
    case 'LineString':
      return [validateDuplicate(geom.coordinates)]
    case 'MultiLineString':
      return geom.coordinates.map((line) => validateDuplicate(line))
    case 'Polygon':
      return geom.coordinates.map((ring) => validateDuplicate(ring, true))
    case 'MultiPolygon':
      return geom.coordinates.flatMap((polygon) =>
        polygon.map((ring) => validateDuplicate(ring, true)),
      )
    case 'MultiPoint':
      return geom.coordinates.map((point) => [[point[0], point[1]]])
    case 'GeometryCollection':
      return geom.geometries.flatMap((part) => extractPathsFromSingleGeom(part))
    default:
      return []
  }
}

export const extractPaths = (geom: Geometry): number[][][] => extractPathsFromSingleGeom(geom)

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
    if (pathCoords.length === 0) continue

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
