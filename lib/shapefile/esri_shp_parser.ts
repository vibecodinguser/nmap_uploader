import {
  ESRI_FILE_CODE,
  ESRI_HEADER_BYTES,
  ESRI_SHAPE_TYPE,
  ESRI_VERSION,
  readInt32Be,
  readInt32Le,
  type ShpFileSummary,
  type ShpRecordSummary,
  toProcessingError,
} from './esri_types'

export * from './esri_shp_geometry_validator'

const ERR_SHP_HEADER_TOO_SHORT = [
  'Файл .shp слишком короткий:',
  'отсутствует 100-байтовый заголовок',
].join(' ')

const ERR_SHP_MIXED_SHAPE_TYPES = [
  'В .shp смешаны разные типы геометрии;',
  'допустим только один Shape Type',
].join(' ')

const readShpRecordShapeType = (
  view: DataView,
  contentOffset: number,
  contentBytes: number,
): number => {
  if (contentBytes >= 4) {
    return readInt32Le(view, contentOffset)
  }
  return ESRI_SHAPE_TYPE.NULL
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
  if (valueList.length > 0) {
    return valueList[0]
  }
  return undefined
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
