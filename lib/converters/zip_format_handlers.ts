import { gpx, kml } from '@tmcw/togeojson'
import { parseAndValidateGeoJsonText } from '@/lib/geojson/geojson_spec'
import { validateGpxDocument } from '@/lib/gpx/gpx_spec'
import { validateKmlDocument } from '@/lib/kml/kml_spec'
import type { ProcessResult } from '@/lib/nmap_index'
import { processGeoJsonData } from './geojson'
import {
  parseXml,
  processShapefileZip,
  processTopoJson,
  processWkt,
} from './individual_format_processors'
import {
  findGeoJsonZipEntry,
  findZipEntry,
  readZipEntryText,
  rethrowZipProcessingError,
  textToArrayBuffer,
  type ZipContext,
} from './zip_handler'

export const tryProcessZipShapefile = async ({
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

export const tryProcessZipGeoJson = async ({
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

export const tryProcessZipKml = async ({
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

export const tryProcessZipGpx = async ({
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

export const tryProcessZipTopoJson = async ({
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

export const tryProcessZipWkt = async ({
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
