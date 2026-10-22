import type { Geometry } from 'geojson'
import { extractPaths, getPointForGeometry } from '@/lib/geometry'
import type { ProcessResult } from '@/lib/nmap_index'
import { createNmapOutputTemplate } from '@/lib/nmap_index'

export type ConverterInput = {
  buffer: ArrayBuffer
  fileDesc: string
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const appendUniqueMetadata = (metadata: string[], items: string[]): void => {
  for (const item of items) {
    if (!metadata.includes(item)) {
      metadata.push(item)
    }
  }
}

export const mergePartIntoResult = (merged: ProcessResult, part: ProcessResult): void => {
  merged.paths = { ...merged.paths, ...part.paths }
  merged.points = { ...merged.points, ...part.points }
  appendUniqueMetadata(merged.metadata, part.metadata)
}

export const mergeProcessResults = (parts: ProcessResult[]): ProcessResult => {
  const merged: ProcessResult = { ...createNmapOutputTemplate(), metadata: [] }
  for (const part of parts) {
    mergePartIntoResult(merged, part)
  }
  return merged
}

export const addWktGeometryToOutput = (
  output: ProcessResult,
  geom: Geometry,
  fileDesc: string,
): void => {
  const paths = extractPaths(geom)

  for (const pathCoords of paths) {
    const sharedUuid = crypto.randomUUID()
    output.paths[sharedUuid] = pathCoords
    const pointCoords = getPointForGeometry(geom.type, pathCoords)
    if (pointCoords) {
      output.points[sharedUuid] = { coords: pointCoords, desc: fileDesc }
    }
  }
}
