import { gpx, kml } from '@tmcw/togeojson'
import JSZip from 'jszip'
import shp from 'shpjs'
import { feature } from 'topojson-client'
import { type BinaryPayload, normalizeBinaryBuffer } from '@/lib/binary_buffer'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import { getFileExtension } from '@/lib/formats'
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

const findZipEntry = (entries: string[], pattern: RegExp): string | undefined =>
  entries.find((name) => pattern.test(name.toLowerCase()))

const listZipEntries = (zip: JSZip): string[] =>
  Object.keys(zip.files).filter((name) => !zip.files[name]?.dir)

const parseXml = (text: string): Document => parseXmlDocument(text)

const processGpx = async ({
  buffer,
  fileDesc,
}: {
  buffer: ArrayBuffer
  fileDesc: string
}): Promise<ProcessResult> => {
  const text = new TextDecoder('utf-8').decode(buffer)
  const doc = parseXml(text)
  validateGpxDocument(doc)
  const geojson = gpx(doc)
  return processGeoJsonData({ data: geojson, fileDesc })
}

const processKml = async ({
  buffer,
  fileDesc,
}: {
  buffer: ArrayBuffer
  fileDesc: string
}): Promise<ProcessResult> => {
  const kmlText = await readValidatedKmlFromBuffer(buffer)
  const geojson = kml(parseXml(kmlText))
  return processGeoJsonData({
    data: geojson as Parameters<typeof processGeoJsonData>[0]['data'],
    fileDesc,
  })
}

const processGeoJsonFile = async ({
  buffer,
  fileDesc,
}: {
  buffer: ArrayBuffer
  fileDesc: string
}): Promise<ProcessResult> => {
  const data = parseAndValidateGeoJsonBuffer(buffer)
  return processGeoJsonData({ data, fileDesc })
}

const processTopoJson = async ({
  buffer,
  fileDesc,
}: {
  buffer: ArrayBuffer
  fileDesc: string
}): Promise<ProcessResult> => {
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
      merged.paths = { ...merged.paths, ...part.paths }
      merged.points = { ...merged.points, ...part.points }
      for (const item of part.metadata) {
        if (!merged.metadata.includes(item)) merged.metadata.push(item)
      }
    }
    return merged
  } catch (error) {
    if (error instanceof ProcessingError) throw error
    throw new ProcessingError(
      ERR_SHAPEFILE,
      `Ошибка чтения TopoJSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

const processWkt = async ({
  buffer,
  fileDesc,
}: {
  buffer: ArrayBuffer
  fileDesc: string
}): Promise<ProcessResult> => {
  const text = decodeUtf8WktText(buffer)
  const lines = extractWktGeometryLines(text)
  if (lines.length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'WKT-файл не содержит строк с геометрией')
  }

  const output: ProcessResult = { ...createNmapOutputTemplate(), metadata: [] }

  for (const line of lines) {
    const geom = parseAndValidateGeometryWkt(line)
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

  if (Object.keys(output.paths).length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'Геометрия WKT файла не валидна')
  }

  return output
}

const mergeProcessResults = (parts: ProcessResult[]): ProcessResult => {
  const merged: ProcessResult = { ...createNmapOutputTemplate(), metadata: [] }
  for (const part of parts) {
    merged.paths = { ...merged.paths, ...part.paths }
    merged.points = { ...merged.points, ...part.points }
    for (const item of part.metadata) {
      if (!merged.metadata.includes(item)) merged.metadata.push(item)
    }
  }
  return merged
}

const processShapefileZip = async ({
  buffer,
  fileDesc,
}: {
  buffer: ArrayBuffer
  fileDesc: string
}): Promise<ProcessResult> => {
  await validateEsriShapefileZip(buffer)
  const geojson = await shp(buffer)
  const collections = Array.isArray(geojson) ? geojson : [geojson]
  const merged = mergeProcessResults(
    collections.map((collection) => processGeoJsonData({ data: collection, fileDesc })),
  )

  if (Object.keys(merged.paths).length === 0 && Object.keys(merged.points).length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'Shapefile пуст')
  }

  return merged
}

const processZip = async ({
  buffer,
  fileDesc,
}: {
  buffer: ArrayBuffer
  fileDesc: string
}): Promise<ProcessResult> => {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch (error) {
    throw new ProcessingError(
      ERR_SHAPEFILE,
      `Ошибка чтения ZIP-файла: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const entries = listZipEntries(zip)
  if (entries.length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'ZIP-архив пуст')
  }

  if (findZipEntry(entries, /\.shp$/)) {
    try {
      return await processShapefileZip({ buffer, fileDesc })
    } catch (error) {
      if (error instanceof ProcessingError) throw error
      throw new ProcessingError(
        ERR_SHAPEFILE,
        `Ошибка чтения Shapefile: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const geoJsonName =
    findZipEntry(entries, /\.geojson$/) ??
    findZipEntry(entries, /(^|\/)data\.json$/) ??
    entries.find((name) => name.toLowerCase().endsWith('.json'))

  if (geoJsonName) {
    try {
      const text = (await zip.file(geoJsonName)?.async('text')) ?? ''
      const data = parseAndValidateGeoJsonText(text)
      return processGeoJsonData({ data, fileDesc })
    } catch (error) {
      if (error instanceof ProcessingError) throw error
      throw new ProcessingError(
        ERR_SHAPEFILE,
        `Ошибка чтения GeoJSON из ZIP: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const kmlName = findZipEntry(entries, /\.kml$/)
  if (kmlName) {
    const kmlText = (await zip.file(kmlName)?.async('text')) ?? ''
    const doc = parseXml(kmlText)
    validateKmlDocument(doc)
    const geojson = kml(doc)
    return processGeoJsonData({
      data: geojson as Parameters<typeof processGeoJsonData>[0]['data'],
      fileDesc,
    })
  }

  const gpxName = findZipEntry(entries, /\.gpx$/)
  if (gpxName) {
    const gpxText = (await zip.file(gpxName)?.async('text')) ?? ''
    const doc = parseXml(gpxText)
    validateGpxDocument(doc)
    const geojson = gpx(doc)
    return processGeoJsonData({ data: geojson, fileDesc })
  }

  const topoJsonName = findZipEntry(entries, /\.topojson$/)
  if (topoJsonName) {
    const topoText = (await zip.file(topoJsonName)?.async('text')) ?? ''
    return processTopoJson({ buffer: new TextEncoder().encode(topoText).buffer, fileDesc })
  }

  const wktName = findZipEntry(entries, /\.wkt$/)
  if (wktName) {
    const wktText = (await zip.file(wktName)?.async('text')) ?? ''
    return processWkt({ buffer: new TextEncoder().encode(wktText).buffer, fileDesc })
  }

  const sample = entries
    .map((entry) => entry.split('/').pop() ?? entry)
    .slice(0, 6)
    .join(', ')

  throw new ProcessingError(
    ERR_SHAPEFILE,
    `ZIP не содержит поддерживаемых файлов (.shp, .geojson, .kml, .gpx, .topojson, .wkt). Найдено: ${sample}`,
  )
}

export type UploadFileInput = {
  name: string
  buffer: ArrayBuffer | BinaryPayload
}

/** Универсальная точка входа: выбор обработчика по расширению. */
export const processFile = async ({ name, buffer }: UploadFileInput): Promise<ProcessResult> => {
  const normalizedBuffer = normalizeBinaryBuffer(buffer)
  const extension = getFileExtension(name)
  const fileDesc = name.split('/').pop() ?? name

  switch (extension) {
    case 'zip':
      return processZip({ buffer: normalizedBuffer, fileDesc })
    case 'gpx':
      return processGpx({ buffer: normalizedBuffer, fileDesc })
    case 'kml':
    case 'kmz':
      return processKml({ buffer: normalizedBuffer, fileDesc })
    case 'geojson':
      return processGeoJsonFile({ buffer: normalizedBuffer, fileDesc })
    case 'topojson':
      return processTopoJson({ buffer: normalizedBuffer, fileDesc })
    case 'wkt':
      return processWkt({ buffer: normalizedBuffer, fileDesc })
    default:
      throw new ProcessingError(ERR_SHAPEFILE, `Неподдерживаемый тип файла: .${extension}`)
  }
}
