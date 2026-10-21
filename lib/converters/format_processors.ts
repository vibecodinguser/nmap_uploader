import { gpx, kml } from '@tmcw/togeojson'
import type { Geometry } from 'geojson'
import shp from 'shpjs'
import { feature } from 'topojson-client'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import {
  parseAndValidateGeoJsonBuffer,
  parseAndValidateGeoJsonText,
} from '@/lib/geojson/geojson_spec'
import { extractPaths, getPointForGeometry } from '@/lib/geometry'
import { validateGpxDocument } from '@/lib/gpx/gpx_spec'
import { readValidatedKmlFromBuffer, validateKmlDocument } from '@/lib/kml/kml_spec'
import type { ProcessResult } from '@/lib/nmap_index'
import { createNmapOutputTemplate } from '@/lib/nmap_index'
import { validateEsriShapefileZip } from '@/lib/shapefile/esri_spec'
import { parseAndValidateTopoJsonBuffer } from '@/lib/topojson/topojson_spec'
import {
  decodeUtf8WktText,
  extractWktGeometryLines,
  parseAndValidateGeometryWkt,
} from '@/lib/wkt/wkt_spec'
import { parseXmlDocument } from '@/lib/xml/parse_xml'
import { processGeoJsonData } from './geojson'
import {
  buildZipSample,
  findGeoJsonZipEntry,
  findZipEntry,
  listZipEntries,
  loadZipFromBuffer,
  readZipEntryText,
  rethrowZipProcessingError,
  textToArrayBuffer,
  type ZipContext,
} from './zip_handler'

export type ConverterInput = {
  buffer: ArrayBuffer
  fileDesc: string
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const parseXml = (text: string): Document => parseXmlDocument(text)

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

const addWktGeometryToOutput = (output: ProcessResult, geom: Geometry, fileDesc: string): void => {
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

export const processGpx = async ({ buffer, fileDesc }: ConverterInput): Promise<ProcessResult> => {
  const decoder = new TextDecoder('utf-8')
  const text = decoder.decode(buffer)
  const doc = parseXml(text)
  validateGpxDocument(doc)
  const geojson = gpx(doc)
  return processGeoJsonData({ data: geojson, fileDesc })
}

export const processKml = async ({ buffer, fileDesc }: ConverterInput): Promise<ProcessResult> => {
  const kmlText = await readValidatedKmlFromBuffer(buffer)
  const doc = parseXml(kmlText)
  const geojson = kml(doc)
  return processGeoJsonData({
    data: geojson as Parameters<typeof processGeoJsonData>[0]['data'],
    fileDesc,
  })
}

export const processGeoJsonFile = async ({
  buffer,
  fileDesc,
}: ConverterInput): Promise<ProcessResult> => {
  const data = parseAndValidateGeoJsonBuffer(buffer)
  return processGeoJsonData({ data, fileDesc })
}

export const processTopoJson = async ({
  buffer,
  fileDesc,
}: ConverterInput): Promise<ProcessResult> => {
  try {
    const topology = parseAndValidateTopoJsonBuffer(buffer)
    const objectNames = Object.keys(topology.objects ?? {})

    const merged: ProcessResult = { ...createNmapOutputTemplate(), metadata: [] }
    for (const objectName of objectNames) {
      const geoObject = feature(
        topology,
        topology.objects[objectName] as Parameters<typeof feature>[1],
      )
      const part = processGeoJsonData({ data: geoObject, fileDesc })
      mergePartIntoResult(merged, part)
    }
    return merged
  } catch (error) {
    if (error instanceof ProcessingError) {
      throw error
    }
    const errorMessage = getErrorMessage(error)
    throw new ProcessingError(ERR_SHAPEFILE, `Ошибка чтения TopoJSON: ${errorMessage}`)
  }
}

export const processWkt = async ({ buffer, fileDesc }: ConverterInput): Promise<ProcessResult> => {
  const text = decodeUtf8WktText(buffer)
  const lines = extractWktGeometryLines(text)
  if (lines.length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'WKT-файл не содержит строк с геометрией')
  }

  const output: ProcessResult = { ...createNmapOutputTemplate(), metadata: [] }

  for (const line of lines) {
    const geom = parseAndValidateGeometryWkt(line)
    addWktGeometryToOutput(output, geom, fileDesc)
  }

  if (Object.keys(output.paths).length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'Геометрия WKT файла не валидна')
  }

  return output
}

export const processShapefileZip = async ({
  buffer,
  fileDesc,
}: ConverterInput): Promise<ProcessResult> => {
  await validateEsriShapefileZip(buffer)
  const geojson = await shp(buffer)
  const parts: ProcessResult[] = []

  if (Array.isArray(geojson)) {
    for (const collection of geojson) {
      const part = processGeoJsonData({ data: collection, fileDesc })
      parts.push(part)
    }
  } else {
    const part = processGeoJsonData({ data: geojson, fileDesc })
    parts.push(part)
  }

  const merged = mergeProcessResults(parts)

  if (Object.keys(merged.paths).length === 0 && Object.keys(merged.points).length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'Shapefile пуст')
  }

  return merged
}

const tryProcessZipShapefile = async ({
  buffer,
  fileDesc,
  entries,
}: ZipContext): Promise<ProcessResult | undefined> => {
  let result: ProcessResult | undefined

  if (findZipEntry(entries, /\.shp$/)) {
    try {
      result = await processShapefileZip({ buffer, fileDesc })
    } catch (error) {
      rethrowZipProcessingError(error, 'Ошибка чтения Shapefile')
    }
  }

  return result
}

const tryProcessZipGeoJson = async ({
  zip,
  fileDesc,
  entries,
}: ZipContext): Promise<ProcessResult | undefined> => {
  let result: ProcessResult | undefined
  const geoJsonName = findGeoJsonZipEntry(entries)

  if (geoJsonName !== undefined) {
    try {
      const text = await readZipEntryText(zip, geoJsonName)
      const data = parseAndValidateGeoJsonText(text)
      result = processGeoJsonData({ data, fileDesc })
    } catch (error) {
      rethrowZipProcessingError(error, 'Ошибка чтения GeoJSON из ZIP')
    }
  }

  return result
}

const tryProcessZipKml = async ({
  zip,
  fileDesc,
  entries,
}: ZipContext): Promise<ProcessResult | undefined> => {
  let result: ProcessResult | undefined
  const kmlName = findZipEntry(entries, /\.kml$/)

  if (kmlName !== undefined) {
    const kmlText = await readZipEntryText(zip, kmlName)
    const doc = parseXml(kmlText)
    validateKmlDocument(doc)
    const geojson = kml(doc)
    result = processGeoJsonData({
      data: geojson as Parameters<typeof processGeoJsonData>[0]['data'],
      fileDesc,
    })
  }

  return result
}

const tryProcessZipGpx = async ({
  zip,
  fileDesc,
  entries,
}: ZipContext): Promise<ProcessResult | undefined> => {
  let result: ProcessResult | undefined
  const gpxName = findZipEntry(entries, /\.gpx$/)

  if (gpxName !== undefined) {
    const gpxText = await readZipEntryText(zip, gpxName)
    const doc = parseXml(gpxText)
    validateGpxDocument(doc)
    const geojson = gpx(doc)
    result = processGeoJsonData({ data: geojson, fileDesc })
  }

  return result
}

const tryProcessZipTopoJson = async ({
  zip,
  fileDesc,
  entries,
}: ZipContext): Promise<ProcessResult | undefined> => {
  let result: ProcessResult | undefined
  const topoJsonName = findZipEntry(entries, /\.topojson$/)

  if (topoJsonName !== undefined) {
    const topoText = await readZipEntryText(zip, topoJsonName)
    result = await processTopoJson({ buffer: textToArrayBuffer(topoText), fileDesc })
  }

  return result
}

const tryProcessZipWkt = async ({
  zip,
  fileDesc,
  entries,
}: ZipContext): Promise<ProcessResult | undefined> => {
  let result: ProcessResult | undefined
  const wktName = findZipEntry(entries, /\.wkt$/)

  if (wktName !== undefined) {
    const wktText = await readZipEntryText(zip, wktName)
    result = await processWkt({ buffer: textToArrayBuffer(wktText), fileDesc })
  }

  return result
}

const zipEntryHandlers: Array<(context: ZipContext) => Promise<ProcessResult | undefined>> = [
  tryProcessZipShapefile,
  tryProcessZipGeoJson,
  tryProcessZipKml,
  tryProcessZipGpx,
  tryProcessZipTopoJson,
  tryProcessZipWkt,
]

const processZipEntries = async (context: ZipContext): Promise<ProcessResult> => {
  let result: ProcessResult | undefined

  for (const handler of zipEntryHandlers) {
    if (result === undefined) {
      result = await handler(context)
    }
  }

  if (result === undefined) {
    const sample = buildZipSample(context.entries)
    throw new ProcessingError(
      ERR_SHAPEFILE,
      `ZIP не содержит поддерживаемых файлов (.shp, .geojson, .kml, .gpx, .topojson, .wkt). Найдено: ${sample}`,
    )
  }

  return result
}

export const processZip = async ({ buffer, fileDesc }: ConverterInput): Promise<ProcessResult> => {
  const zip = await loadZipFromBuffer(buffer)
  const entries = listZipEntries(zip)

  if (entries.length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'ZIP-архив пуст')
  }

  return processZipEntries({ zip, buffer, fileDesc, entries })
}
