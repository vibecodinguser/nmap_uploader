import { gpx, kml } from '@tmcw/togeojson'
import shp from 'shpjs'
import { feature } from 'topojson-client'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import { parseAndValidateGeoJsonBuffer } from '@/lib/geojson/geojson_spec'
import { validateGpxDocument } from '@/lib/gpx/gpx_spec'
import { readValidatedKmlFromBuffer } from '@/lib/kml/kml_spec'
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
  addWktGeometryToOutput,
  type ConverterInput,
  getErrorMessage,
  mergePartIntoResult,
  mergeProcessResults,
} from './result_merger'

export const parseXml = (text: string): Document => parseXmlDocument(text)

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
