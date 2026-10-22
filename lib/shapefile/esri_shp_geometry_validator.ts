import {
  ESRI_SHAPE_TYPE,
  readDoubleLe,
  readInt32Le,
  type ShpRecordSummary,
  toProcessingError,
} from './esri_types'

const ERR_POLYGON_RING_NOT_CLOSED = [
  'Кольцо Polygon должно быть замкнутым:',
  'первая и последняя вершина совпадают',
].join(' ')

const ERR_INVALID_COORDINATE_SUFFIX = '(NaN или Infinity)'

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
