import JSZip from 'jszip'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

/** Код файла в заголовке .shp/.shx (ESRI Shapefile Technical Description, Table 1). */
export const ESRI_FILE_CODE = 9994

/** Версия формата shapefile. */
export const ESRI_VERSION = 1000

/** Размер заголовка main/index file в байтах. */
export const ESRI_HEADER_BYTES = 100

/** Смещение первой записи в .shp в 16-битных словах. */
export const ESRI_FIRST_RECORD_OFFSET_WORDS = 50

/** Типы геометрии по спецификации ESRI (Table 1, стр. 4 PDF). */
export const ESRI_SHAPE_TYPE = {
  NULL: 0,
  POINT: 1,
  POLYLINE: 3,
  POLYGON: 5,
  MULTIPOINT: 8,
  POINT_Z: 11,
  POLYLINE_Z: 13,
  POLYGON_Z: 15,
  MULTIPOINT_Z: 18,
  POINT_M: 21,
  POLYLINE_M: 23,
  POLYGON_M: 25,
  MULTIPOINT_M: 28,
  MULTIPATCH: 31,
} as const

export type ShapefileComponentSet = {
  basename: string
  shp: ArrayBuffer
  shx: ArrayBuffer
  dbf: ArrayBuffer
}

type ShpRecordSummary = {
  recordNumber: number
  contentLengthWords: number
  shapeType: number
  contentOffset: number
}

type ShpFileSummary = {
  fileLengthWords: number
  headerShapeType: number
  records: ShpRecordSummary[]
}

const readInt32Be = (view: DataView, offset: number): number => view.getInt32(offset, false)

const readInt32Le = (view: DataView, offset: number): number => view.getInt32(offset, true)

const readUint32Le = (view: DataView, offset: number): number => view.getUint32(offset, true)

const readDoubleLe = (view: DataView, offset: number): number => view.getFloat64(offset, true)

/**
 * Проверяет basename shapefile: допустимые символы, без ограничения 8.3
 * (актуально для ZIP/GeoServer).
 */
export const isValidEsriBasename = (basename: string): boolean => {
  let isValid = false
  if (basename) {
    isValid = /^[a-z0-9][a-z0-9_-]*$/i.test(basename)
  }

  return isValid
}

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

const ERR_SHP_HEADER_TOO_SHORT = [
  'Файл .shp слишком короткий:',
  'отсутствует 100-байтовый заголовок',
].join(' ')

const ERR_SHP_MIXED_SHAPE_TYPES = [
  'В .shp смешаны разные типы геометрии;',
  'допустим только один Shape Type',
].join(' ')

const ERR_POLYGON_RING_NOT_CLOSED = [
  'Кольцо Polygon должно быть замкнутым:',
  'первая и последняя вершина совпадают',
].join(' ')

const ERR_INVALID_COORDINATE_SUFFIX = '(NaN или Infinity)'

const ERR_SHX_HEADER_TOO_SHORT = [
  'Файл .shx слишком короткий:',
  'отсутствует 100-байтовый заголовок',
].join(' ')

const ERR_SHX_INDEX_ALIGNMENT = [
  'Размер индексных записей .shx',
  'должен быть кратен 8 байтам',
].join(' ')

type ShapefileParts = Partial<Record<'shp' | 'shx' | 'dbf', ArrayBuffer>>

const basenameFromZipEntryPath = (rawName: string): string => {
  const withForwardSlashes = rawName.replace(/\\/g, '/')
  const pathParts = withForwardSlashes.split('/')
  const lastPart = pathParts.pop()
  let normalized = rawName
  if (lastPart) {
    normalized = lastPart
  }

  return normalized
}

const collectNonNullShapeTypes = (records: ShpRecordSummary[]): Set<number> => {
  const nonNullTypes = new Set<number>()

  for (const record of records) {
    if (record.shapeType !== ESRI_SHAPE_TYPE.NULL) {
      nonNullTypes.add(record.shapeType)
    }
  }

  return nonNullTypes
}

const firstSetValue = <T>(values: Set<T>): T | undefined => {
  const valueList = Array.from(values)
  let first: T | undefined
  if (valueList.length > 0) {
    first = valueList[0]
  }

  return first
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

const readShpRecordShapeType = (
  view: DataView,
  contentOffset: number,
  contentBytes: number,
): number => {
  let shapeType: number = ESRI_SHAPE_TYPE.NULL
  if (contentBytes >= 4) {
    shapeType = readInt32Le(view, contentOffset)
  }

  return shapeType
}

const parseShpRecords = (view: DataView, buffer: ArrayBuffer): ShpRecordSummary[] => {
  const records: ShpRecordSummary[] = []
  let offset = ESRI_HEADER_BYTES

  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) {
      throw toProcessingError('Обрезанный заголовок записи в .shp')
    }

    const recordNumber = readInt32Be(view, offset)
    const contentLengthWords = readInt32Be(view, offset + 4)
    const contentOffset = offset + 8
    const contentBytes = contentLengthWords * 2

    if (contentOffset + contentBytes > buffer.byteLength) {
      throw toProcessingError(`Запись ${recordNumber} в .shp выходит за пределы файла`)
    }

    const shapeType = readShpRecordShapeType(view, contentOffset, contentBytes)
    records.push({ recordNumber, contentLengthWords, shapeType, contentOffset })
    offset = contentOffset + contentBytes
  }

  return records
}

const readShpMainFileHeader = (
  buffer: ArrayBuffer,
  view: DataView,
): { fileLengthWords: number; headerShapeType: number } => {
  if (buffer.byteLength < ESRI_HEADER_BYTES) {
    throw toProcessingError(ERR_SHP_HEADER_TOO_SHORT)
  }

  const fileCode = readInt32Be(view, 0)
  if (fileCode !== ESRI_FILE_CODE) {
    throw toProcessingError(
      `Некорректный File Code в .shp: ожидался ${ESRI_FILE_CODE}, получен ${fileCode}`,
    )
  }

  const fileLengthWords = readInt32Be(view, 24)
  const version = readInt32Le(view, 28)
  if (version !== ESRI_VERSION) {
    throw toProcessingError(
      `Некорректная Version в .shp: ожидалась ${ESRI_VERSION}, получена ${version}`,
    )
  }

  const expectedBytes = fileLengthWords * 2
  if (buffer.byteLength !== expectedBytes) {
    throw toProcessingError(
      'Длина .shp не совпадает с File Length в заголовке: ' +
        `${buffer.byteLength} байт, ожидалось ${expectedBytes}`,
    )
  }

  const headerShapeType = readInt32Le(view, 32)
  return { fileLengthWords, headerShapeType }
}

/** Парсит заголовок и записи .shp. */
export const parseShpMainFile = (buffer: ArrayBuffer): ShpFileSummary => {
  const view = new DataView(buffer)
  const { fileLengthWords, headerShapeType } = readShpMainFileHeader(buffer, view)
  const records = parseShpRecords(view, buffer)

  return { fileLengthWords, headerShapeType, records }
}

/** Проверяет согласованность типов геометрии в записях .shp. */
export const validateShpRecordShapeTypes = ({ headerShapeType, records }: ShpFileSummary): void => {
  const nonNullTypes = collectNonNullShapeTypes(records)

  if (nonNullTypes.size > 1) {
    throw toProcessingError(ERR_SHP_MIXED_SHAPE_TYPES)
  }

  if (records.length > 0) {
    const recordType = firstSetValue(nonNullTypes) ?? ESRI_SHAPE_TYPE.NULL
    const shouldValidateTypeMatch = recordType !== ESRI_SHAPE_TYPE.NULL
    if (shouldValidateTypeMatch && headerShapeType !== recordType) {
      throw toProcessingError(
        'Shape Type в заголовке .shp ' +
          `(${headerShapeType}) не совпадает с типом записей (${recordType})`,
      )
    }
  }
}

type PolygonRingLayout = {
  view: DataView
  partsOffset: number
  pointsOffset: number
  numParts: number
  numPoints: number
}

const readPolygonRingLayout = (view: DataView, record: ShpRecordSummary): PolygonRingLayout => {
  const contentOffset = record.contentOffset
  const numParts = readInt32Le(view, contentOffset + 36)
  const numPoints = readInt32Le(view, contentOffset + 40)
  const partsOffset = contentOffset + 44
  const pointsOffset = partsOffset + numParts * 4

  return { view, partsOffset, pointsOffset, numParts, numPoints }
}

const validatePolygonPartClosed = (layout: PolygonRingLayout, partIndex: number): void => {
  const { view, partsOffset, pointsOffset, numParts, numPoints } = layout
  const start = readInt32Le(view, partsOffset + partIndex * 4)
  let end = numPoints
  if (partIndex + 1 < numParts) {
    end = readInt32Le(view, partsOffset + (partIndex + 1) * 4)
  }

  if (end - start < 4) {
    throw toProcessingError('Кольцо Polygon должно содержать минимум 4 вершины')
  }

  const firstOffset = pointsOffset + start * 16
  const lastOffset = pointsOffset + (end - 1) * 16
  const firstX = readDoubleLe(view, firstOffset)
  const firstY = readDoubleLe(view, firstOffset + 8)
  const lastX = readDoubleLe(view, lastOffset)
  const lastY = readDoubleLe(view, lastOffset + 8)

  if (firstX === lastX && firstY === lastY) {
    return
  }

  throw toProcessingError(ERR_POLYGON_RING_NOT_CLOSED)
}

const validatePolygonRecordRingsClosed = (view: DataView, record: ShpRecordSummary): void => {
  const layout = readPolygonRingLayout(view, record)

  for (let partIndex = 0; partIndex < layout.numParts; partIndex += 1) {
    validatePolygonPartClosed(layout, partIndex)
  }
}

/** Проверяет, что кольца Polygon замкнуты (стр. 9 PDF). */
export const validatePolygonRingsClosed = (
  buffer: ArrayBuffer,
  records: ShpRecordSummary[],
): void => {
  const view = new DataView(buffer)

  for (const record of records) {
    if (record.shapeType === ESRI_SHAPE_TYPE.POLYGON) {
      validatePolygonRecordRingsClosed(view, record)
    }
  }
}

const assertFiniteCoordinate = (value: number, context: string): void => {
  if (Number.isFinite(value)) {
    return
  }

  throw toProcessingError(
    `${context}: недопустимое значение координаты ${ERR_INVALID_COORDINATE_SUFFIX}`,
  )
}

const validatePointRecordNumericValues = (view: DataView, contentOffset: number): void => {
  const pointX = readDoubleLe(view, contentOffset + 4)
  const pointY = readDoubleLe(view, contentOffset + 12)
  assertFiniteCoordinate(pointX, 'Point.X')
  assertFiniteCoordinate(pointY, 'Point.Y')
}

const validateMultiVertexRecordNumericValues = (view: DataView, record: ShpRecordSummary): void => {
  const contentOffset = record.contentOffset
  const isMultipoint = record.shapeType === ESRI_SHAPE_TYPE.MULTIPOINT
  let numPoints: number
  let pointsOffset: number
  if (isMultipoint) {
    numPoints = readInt32Le(view, contentOffset + 36)
    pointsOffset = contentOffset + 40
  } else {
    numPoints = readInt32Le(view, contentOffset + 40)
    pointsOffset = contentOffset + 44 + readInt32Le(view, contentOffset + 36) * 4
  }

  for (let pointIndex = 0; pointIndex < numPoints; pointIndex += 1) {
    const pointOffset = pointsOffset + pointIndex * 16
    const pointX = readDoubleLe(view, pointOffset)
    const pointY = readDoubleLe(view, pointOffset + 8)
    assertFiniteCoordinate(pointX, `Points[${pointIndex}].X`)
    assertFiniteCoordinate(pointY, `Points[${pointIndex}].Y`)
  }
}

const isMultiVertexShapeType = (shapeType: number): boolean =>
  shapeType === ESRI_SHAPE_TYPE.POLYLINE ||
  shapeType === ESRI_SHAPE_TYPE.POLYGON ||
  shapeType === ESRI_SHAPE_TYPE.MULTIPOINT

const validateShpRecordNumericValues = (view: DataView, record: ShpRecordSummary): void => {
  if (record.shapeType === ESRI_SHAPE_TYPE.POINT) {
    validatePointRecordNumericValues(view, record.contentOffset)
  } else if (isMultiVertexShapeType(record.shapeType)) {
    validateMultiVertexRecordNumericValues(view, record)
  }
}

/** Проверяет отсутствие NaN/Infinity в координатах (стр. 2 PDF). */
export const validateShpNumericValues = (
  buffer: ArrayBuffer,
  records: ShpRecordSummary[],
): void => {
  const view = new DataView(buffer)

  for (const record of records) {
    validateShpRecordNumericValues(view, record)
  }
}

const assertShxHeaderPresent = (shx: ArrayBuffer): void => {
  if (shx.byteLength >= ESRI_HEADER_BYTES) {
    return
  }

  throw toProcessingError(ERR_SHX_HEADER_TOO_SHORT)
}

const assertShxFileCode = (view: DataView): void => {
  const fileCode = readInt32Be(view, 0)
  if (fileCode === ESRI_FILE_CODE) {
    return
  }

  throw toProcessingError(`Некорректный File Code в .shx: ожидался ${ESRI_FILE_CODE}`)
}

const assertShxFileLength = (shx: ArrayBuffer, shxFileLengthWords: number): void => {
  const expectedShxBytes = shxFileLengthWords * 2
  if (shx.byteLength === expectedShxBytes) {
    return
  }

  throw toProcessingError(
    'Длина .shx не совпадает с File Length в заголовке: ' +
      `${shx.byteLength} байт, ожидалось ${expectedShxBytes}`,
  )
}

const assertShxIndexAlignment = (indexRecordBytes: number): void => {
  if (indexRecordBytes % 8 === 0) {
    return
  }

  throw toProcessingError(ERR_SHX_INDEX_ALIGNMENT)
}

const assertShxRecordCountMatches = (indexRecordCount: number, shpRecordCount: number): void => {
  if (indexRecordCount === shpRecordCount) {
    return
  }

  throw toProcessingError(
    'Число записей .shx ' +
      `(${indexRecordCount}) не совпадает с числом записей .shp (${shpRecordCount})`,
  )
}

const assertShxIndexRecordMatches = (
  index: number,
  indexOffsetWords: number,
  expectedOffsetWords: number,
  indexContentLengthWords: number,
  shpContentLengthWords: number,
): void => {
  if (indexOffsetWords === expectedOffsetWords) {
    if (indexContentLengthWords === shpContentLengthWords) {
      return
    }

    throw toProcessingError(`Content Length записи ${index + 1} в .shx не совпадает с .shp`)
  }

  throw toProcessingError(
    `Некорректное смещение записи ${index + 1} в .shx: ` +
      `ожидалось ${expectedOffsetWords}, получено ${indexOffsetWords}`,
  )
}

const validateShxIndexRecords = (shxView: DataView, shpRecords: ShpRecordSummary[]): void => {
  let expectedOffsetWords = ESRI_FIRST_RECORD_OFFSET_WORDS

  for (let index = 0; index < shpRecords.length; index += 1) {
    const shpRecord = shpRecords[index]
    const shxOffset = ESRI_HEADER_BYTES + index * 8
    const indexOffsetWords = readInt32Be(shxView, shxOffset)
    const indexContentLengthWords = readInt32Be(shxView, shxOffset + 4)

    assertShxIndexRecordMatches(
      index,
      indexOffsetWords,
      expectedOffsetWords,
      indexContentLengthWords,
      shpRecord.contentLengthWords,
    )

    expectedOffsetWords += 4 + shpRecord.contentLengthWords
  }
}

/** Парсит индекс .shx и сверяет его с .shp (Table 17, стр. 24 PDF). */
export const validateShxAgainstShp = (shp: ArrayBuffer, shx: ArrayBuffer): void => {
  assertShxHeaderPresent(shx)

  const shpSummary = parseShpMainFile(shp)
  const shxView = new DataView(shx)

  assertShxFileCode(shxView)

  const shxFileLengthWords = readInt32Be(shxView, 24)
  assertShxFileLength(shx, shxFileLengthWords)

  const indexRecordBytes = shx.byteLength - ESRI_HEADER_BYTES
  assertShxIndexAlignment(indexRecordBytes)

  const indexRecordCount = indexRecordBytes / 8
  assertShxRecordCountMatches(indexRecordCount, shpSummary.records.length)

  validateShxIndexRecords(shxView, shpSummary.records)
}

/** Возвращает число записей dBASE (стр. 25 PDF). */
export const countDbfRecords = (buffer: ArrayBuffer): number => {
  if (buffer.byteLength < 12) {
    throw toProcessingError('Файл .dbf слишком короткий')
  }

  const view = new DataView(buffer)
  return readUint32Le(view, 4)
}

/** Проверяет dBASE: одна запись на фигуру, порядок совпадает с .shp. */
export const validateDbfAgainstShp = (dbf: ArrayBuffer, shpRecordCount: number): void => {
  const dbfRecords = countDbfRecords(dbf)
  if (dbfRecords !== shpRecordCount) {
    throw toProcessingError(
      'Число записей .dbf ' +
        `(${dbfRecords}) не совпадает с числом фигур в .shp (${shpRecordCount})`,
    )
  }
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
    if (file.dir) {
      // skip directories
    } else {
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
