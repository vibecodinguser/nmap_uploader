import {
  ESRI_FILE_CODE,
  ESRI_HEADER_BYTES,
  ESRI_SHAPE_TYPE,
  ESRI_VERSION,
  readDoubleLe,
  readInt32Be,
  readInt32Le,
  type ShpFileSummary,
  type ShpRecordSummary,
  toProcessingError,
} from './esri_types'

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
