import JSZip from 'jszip'
import { validateDbfAgainstShp } from './esri_dbf_validator'
import {
  parseShpMainFile,
  validatePolygonRingsClosed,
  validateShpNumericValues,
  validateShpRecordShapeTypes,
} from './esri_shp_parser'
import { validateShxAgainstShp } from './esri_shx_validator'
import { isValidEsriBasename, type ShapefileComponentSet, toProcessingError } from './esri_types'

export * from './esri_dbf_validator'
export * from './esri_shp_parser'
export * from './esri_shx_validator'
export * from './esri_types'

type ShapefileParts = Partial<Record<'shp' | 'shx' | 'dbf', ArrayBuffer>>

const basenameFromZipEntryPath = (rawName: string): string => {
  const withForwardSlashes = rawName.replace(/\\/g, '/')
  const pathParts = withForwardSlashes.split('/')
  const lastPart = pathParts.pop()
  if (lastPart) {
    return lastPart
  }
  return rawName
}

const collectShapefilePartsByBasename = (
  entries: ReadonlyMap<string, ArrayBuffer>,
): Map<string, ShapefileParts> => {
  const byBasename = new Map<string, ShapefileParts>()

  for (const [rawName, buffer] of entries) {
    const normalized = basenameFromZipEntryPath(rawName)
    const match = normalized.match(/^([^.]+)\.(shp|shx|dbf)$/i)
    if (match) {
      const basename = match[1]
      const suffix = match[2].toLowerCase() as 'shp' | 'shx' | 'dbf'
      const bucket = byBasename.get(basename) ?? {}
      bucket[suffix] = buffer
      byBasename.set(basename, bucket)
    }
  }

  return byBasename
}

const toShapefileComponentSets = (
  byBasename: Map<string, ShapefileParts>,
): ShapefileComponentSet[] => {
  const sets: ShapefileComponentSet[] = []

  for (const [basename, parts] of byBasename) {
    if (parts.shp) {
      sets.push({
        basename,
        shp: parts.shp,
        shx: parts.shx ?? new ArrayBuffer(0),
        dbf: parts.dbf ?? new ArrayBuffer(0),
      })
    }
  }

  return sets
}

/** Извлекает наборы .shp/.shx/.dbf с общим префиксом из ZIP. */
export const extractShapefileComponentSets = (
  entries: ReadonlyMap<string, ArrayBuffer>,
): ShapefileComponentSet[] => {
  const byBasename = collectShapefilePartsByBasename(entries)
  return toShapefileComponentSets(byBasename)
}

/** Полная проверка одного набора shapefile по ESRI-спецификации. */
export const validateEsriShapefileSet = (set: ShapefileComponentSet): void => {
  if (!isValidEsriBasename(set.basename)) {
    throw toProcessingError(
      `Некорректное имя shapefile "${set.basename}": допустимы [a-z0-9][a-z0-9_-]*`,
    )
  }

  if (!set.shx.byteLength) {
    throw toProcessingError(`Отсутствует индексный файл .shx для "${set.basename}"`)
  }

  if (!set.dbf.byteLength) {
    throw toProcessingError(`Отсутствует таблица атрибутов .dbf для "${set.basename}"`)
  }

  const shpSummary = parseShpMainFile(set.shp)
  validateShpRecordShapeTypes(shpSummary)
  validateShpNumericValues(set.shp, shpSummary.records)
  validatePolygonRingsClosed(set.shp, shpSummary.records)
  validateShxAgainstShp(set.shp, set.shx)
  validateDbfAgainstShp(set.dbf, shpSummary.records.length)
}

const listZipBuffers = async (buffer: ArrayBuffer): Promise<Map<string, ArrayBuffer>> => {
  const zip = await JSZip.loadAsync(buffer)
  const entries = new Map<string, ArrayBuffer>()

  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir) {
      const fileBuffer = await file.async('arraybuffer')
      entries.set(name, fileBuffer)
    }
  }

  return entries
}

/** Проверяет ZIP с shapefile перед конвертацией. */
export const validateEsriShapefileZip = async (buffer: ArrayBuffer): Promise<void> => {
  const entries = await listZipBuffers(buffer)
  const sets = extractShapefileComponentSets(entries)

  if (sets.length === 0) {
    throw toProcessingError('ZIP не содержит файлов .shp')
  }

  for (const set of sets) {
    validateEsriShapefileSet(set)
  }
}
