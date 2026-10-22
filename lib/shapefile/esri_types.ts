import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

export const ESRI_FILE_CODE = 9994
export const ESRI_VERSION = 1000
export const ESRI_HEADER_BYTES = 100
export const ESRI_FIRST_RECORD_OFFSET_WORDS = 50

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

export type ShpRecordSummary = {
  recordNumber: number
  contentLengthWords: number
  shapeType: number
  contentOffset: number
}

export type ShpFileSummary = {
  fileLengthWords: number
  headerShapeType: number
  records: ShpRecordSummary[]
}

export const readInt32Be = (view: DataView, offset: number): number => view.getInt32(offset, false)
export const readInt32Le = (view: DataView, offset: number): number => view.getInt32(offset, true)
export const readUint32Le = (view: DataView, offset: number): number => view.getUint32(offset, true)
export const readDoubleLe = (view: DataView, offset: number): number =>
  view.getFloat64(offset, true)

export const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

export const isValidEsriBasename = (basename: string): boolean => {
  if (basename) {
    return /^[a-z0-9][a-z0-9_-]*$/i.test(basename)
  }
  return false
}
