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

export type EsriShapeType = (typeof ESRI_SHAPE_TYPE)[keyof typeof ESRI_SHAPE_TYPE]

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

/** Проверяет basename shapefile: допустимые символы, без ограничения 8.3 (актуально для ZIP/GeoServer). */
export const isValidEsriBasename = (basename: string): boolean => {
  if (!basename) return false
  return /^[a-z0-9][a-z0-9_-]*$/i.test(basename)
}

/** Проверяет basename по строгому правилу 8.3 DOS (стр. 2 PDF). */
export const isValidEsriDosBasename = (basename: string): boolean => {
  if (!basename || basename.length > 8) return false
  return /^[a-z0-9][a-z0-9_-]{0,7}$/i.test(basename)
}

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

/** Извлекает наборы .shp/.shx/.dbf с общим префиксом из ZIP. */
export const extractShapefileComponentSets = (
  entries: ReadonlyMap<string, ArrayBuffer>,
): ShapefileComponentSet[] => {
  const byBasename = new Map<string, Partial<Record<'shp' | 'shx' | 'dbf', ArrayBuffer>>>()

  for (const [rawName, buffer] of entries) {
    const normalized = rawName.replace(/\\/g, '/').split('/').pop() ?? rawName
    const match = normalized.match(/^([^.]+)\.(shp|shx|dbf)$/i)
    if (!match) continue

    const basename = match[1]
    const suffix = match[2].toLowerCase() as 'shp' | 'shx' | 'dbf'
    const bucket = byBasename.get(basename) ?? {}
    bucket[suffix] = buffer
    byBasename.set(basename, bucket)
  }

  const sets: ShapefileComponentSet[] = []
  for (const [basename, parts] of byBasename) {
    if (!parts.shp) continue
    sets.push({
      basename,
      shp: parts.shp,
      shx: parts.shx ?? new ArrayBuffer(0),
      dbf: parts.dbf ?? new ArrayBuffer(0),
    })
  }

  return sets
}

/** Парсит заголовок и записи .shp. */
export const parseShpMainFile = (buffer: ArrayBuffer): ShpFileSummary => {
  if (buffer.byteLength < ESRI_HEADER_BYTES) {
    throw toProcessingError('Файл .shp слишком короткий: отсутствует 100-байтовый заголовок')
  }

  const view = new DataView(buffer)
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
      `Длина .shp не совпадает с File Length в заголовке: ${buffer.byteLength} байт, ожидалось ${expectedBytes}`,
    )
  }

  const headerShapeType = readInt32Le(view, 32)
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

    const shapeType = contentBytes >= 4 ? readInt32Le(view, contentOffset) : ESRI_SHAPE_TYPE.NULL
    records.push({ recordNumber, contentLengthWords, shapeType, contentOffset })
    offset = contentOffset + contentBytes
  }

  return { fileLengthWords, headerShapeType, records }
}

/** Проверяет согласованность типов геометрии в записях .shp. */
export const validateShpRecordShapeTypes = ({ headerShapeType, records }: ShpFileSummary): void => {
  const nonNullTypes = new Set(
    records.map((record) => record.shapeType).filter((type) => type !== ESRI_SHAPE_TYPE.NULL),
  )

  if (nonNullTypes.size > 1) {
    throw toProcessingError('В .shp смешаны разные типы геометрии; допустим только один Shape Type')
  }

  if (records.length === 0) return

  const recordType = nonNullTypes.values().next().value ?? ESRI_SHAPE_TYPE.NULL
  if (recordType !== ESRI_SHAPE_TYPE.NULL && headerShapeType !== recordType) {
    throw toProcessingError(
      `Shape Type в заголовке .shp (${headerShapeType}) не совпадает с типом записей (${recordType})`,
    )
  }
}

/** Проверяет, что кольца Polygon замкнуты (стр. 9 PDF). */
export const validatePolygonRingsClosed = (
  buffer: ArrayBuffer,
  records: ShpRecordSummary[],
): void => {
  const view = new DataView(buffer)

  for (const record of records) {
    if (record.shapeType !== ESRI_SHAPE_TYPE.POLYGON) continue

    const contentOffset = record.contentOffset
    const numParts = readInt32Le(view, contentOffset + 36)
    const numPoints = readInt32Le(view, contentOffset + 40)
    const partsOffset = contentOffset + 44
    const pointsOffset = partsOffset + numParts * 4

    for (let partIndex = 0; partIndex < numParts; partIndex += 1) {
      const start = readInt32Le(view, partsOffset + partIndex * 4)
      const end =
        partIndex + 1 < numParts ? readInt32Le(view, partsOffset + (partIndex + 1) * 4) : numPoints
      if (end - start < 4) {
        throw toProcessingError('Кольцо Polygon должно содержать минимум 4 вершины')
      }

      const firstOffset = pointsOffset + start * 16
      const lastOffset = pointsOffset + (end - 1) * 16
      const x0 = readDoubleLe(view, firstOffset)
      const y0 = readDoubleLe(view, firstOffset + 8)
      const x1 = readDoubleLe(view, lastOffset)
      const y1 = readDoubleLe(view, lastOffset + 8)

      if (x0 !== x1 || y0 !== y1) {
        throw toProcessingError(
          'Кольцо Polygon должно быть замкнутым: первая и последняя вершина совпадают',
        )
      }
    }
  }
}

/** Проверяет отсутствие NaN/Infinity в координатах (стр. 2 PDF). */
export const validateShpNumericValues = (
  buffer: ArrayBuffer,
  records: ShpRecordSummary[],
): void => {
  const view = new DataView(buffer)

  const assertFinite = (value: number, context: string): void => {
    if (!Number.isFinite(value)) {
      throw toProcessingError(`${context}: недопустимое значение координаты (NaN или Infinity)`)
    }
  }

  for (const record of records) {
    if (record.shapeType === ESRI_SHAPE_TYPE.NULL) continue

    const contentOffset = record.contentOffset

    if (record.shapeType === ESRI_SHAPE_TYPE.POINT) {
      assertFinite(readDoubleLe(view, contentOffset + 4), 'Point.X')
      assertFinite(readDoubleLe(view, contentOffset + 12), 'Point.Y')
      continue
    }

    if (
      record.shapeType === ESRI_SHAPE_TYPE.POLYLINE ||
      record.shapeType === ESRI_SHAPE_TYPE.POLYGON ||
      record.shapeType === ESRI_SHAPE_TYPE.MULTIPOINT
    ) {
      const numPoints =
        record.shapeType === ESRI_SHAPE_TYPE.MULTIPOINT
          ? readInt32Le(view, contentOffset + 36)
          : readInt32Le(view, contentOffset + 40)
      const pointsOffset =
        record.shapeType === ESRI_SHAPE_TYPE.MULTIPOINT
          ? contentOffset + 40
          : contentOffset + 44 + readInt32Le(view, contentOffset + 36) * 4

      for (let pointIndex = 0; pointIndex < numPoints; pointIndex += 1) {
        const pointOffset = pointsOffset + pointIndex * 16
        assertFinite(readDoubleLe(view, pointOffset), `Points[${pointIndex}].X`)
        assertFinite(readDoubleLe(view, pointOffset + 8), `Points[${pointIndex}].Y`)
      }
    }
  }
}

/** Парсит индекс .shx и сверяет его с .shp (Table 17, стр. 24 PDF). */
export const validateShxAgainstShp = (shp: ArrayBuffer, shx: ArrayBuffer): void => {
  if (shx.byteLength < ESRI_HEADER_BYTES) {
    throw toProcessingError('Файл .shx слишком короткий: отсутствует 100-байтовый заголовок')
  }

  const shpSummary = parseShpMainFile(shp)
  const shxView = new DataView(shx)

  if (readInt32Be(shxView, 0) !== ESRI_FILE_CODE) {
    throw toProcessingError(`Некорректный File Code в .shx: ожидался ${ESRI_FILE_CODE}`)
  }

  const shxFileLengthWords = readInt32Be(shxView, 24)
  const expectedShxBytes = shxFileLengthWords * 2
  if (shx.byteLength !== expectedShxBytes) {
    throw toProcessingError(
      `Длина .shx не совпадает с File Length в заголовке: ${shx.byteLength} байт, ожидалось ${expectedShxBytes}`,
    )
  }

  const indexRecordBytes = shx.byteLength - ESRI_HEADER_BYTES
  if (indexRecordBytes % 8 !== 0) {
    throw toProcessingError('Размер индексных записей .shx должен быть кратен 8 байтам')
  }

  const indexRecordCount = indexRecordBytes / 8
  if (indexRecordCount !== shpSummary.records.length) {
    throw toProcessingError(
      `Число записей .shx (${indexRecordCount}) не совпадает с числом записей .shp (${shpSummary.records.length})`,
    )
  }

  let expectedOffsetWords = ESRI_FIRST_RECORD_OFFSET_WORDS
  for (let index = 0; index < shpSummary.records.length; index += 1) {
    const shpRecord = shpSummary.records[index]
    const shxOffset = ESRI_HEADER_BYTES + index * 8
    const indexOffsetWords = readInt32Be(shxView, shxOffset)
    const indexContentLengthWords = readInt32Be(shxView, shxOffset + 4)

    if (indexOffsetWords !== expectedOffsetWords) {
      throw toProcessingError(
        `Некорректное смещение записи ${index + 1} в .shx: ожидалось ${expectedOffsetWords}, получено ${indexOffsetWords}`,
      )
    }

    if (indexContentLengthWords !== shpRecord.contentLengthWords) {
      throw toProcessingError(`Content Length записи ${index + 1} в .shx не совпадает с .shp`)
    }

    expectedOffsetWords += 4 + shpRecord.contentLengthWords
  }
}

/** Возвращает число записей dBASE (стр. 25 PDF). */
export const countDbfRecords = (buffer: ArrayBuffer): number => {
  if (buffer.byteLength < 12) {
    throw toProcessingError('Файл .dbf слишком короткий')
  }
  return readUint32Le(new DataView(buffer), 4)
}

/** Проверяет dBASE: одна запись на фигуру, порядок совпадает с .shp. */
export const validateDbfAgainstShp = (dbf: ArrayBuffer, shpRecordCount: number): void => {
  const dbfRecords = countDbfRecords(dbf)
  if (dbfRecords !== shpRecordCount) {
    throw toProcessingError(
      `Число записей .dbf (${dbfRecords}) не совпадает с числом фигур в .shp (${shpRecordCount})`,
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
    if (file.dir) continue
    entries.set(name, await file.async('arraybuffer'))
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
