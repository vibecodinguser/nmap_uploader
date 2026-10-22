import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

export const WKT_GEOMETRY_TYPES = [
  'POINT',
  'LINESTRING',
  'POLYGON',
  'MULTIPOINT',
  'MULTILINESTRING',
  'MULTIPOLYGON',
  'GEOMETRYCOLLECTION',
] as const

export const WKT2_CRS_KEYWORDS = new Set([
  'ABRIDGEDTRANSFORMATION',
  'ANCHOR',
  'ANCHOREPOCH',
  'ANGLEUNIT',
  'AREA',
  'AXIS',
  'AXISMAXVALUE',
  'AXISMINVALUE',
  'BASEENGCRS',
  'BASEGEODCRS',
  'BASEGEOGCRS',
  'BASEPARAMCRS',
  'BASEPROJCRS',
  'BASETIMECRS',
  'BASEVERTCRS',
  'BBOX',
  'BEARING',
  'BOUNDCRS',
  'CALENDAR',
  'CITATION',
  'COMPOUNDCRS',
  'CONCATENATEDOPERATION',
  'CONVERSION',
  'COORDEPOCH',
  'COORDINATEMETADATA',
  'COORDINATEOPERATION',
  'CS',
  'DATUM',
  'DEFININGTRANSFORMATION',
  'DERIVEDPROJCRS',
  'DERIVINGCONVERSION',
  'DYNAMIC',
  'EDATUM',
  'ELLIPSOID',
  'ENGCRS',
  'ENGINEERINGCRS',
  'ENGINEERINGDATUM',
  'ENSEMBLE',
  'ENSEMBLEACCURACY',
  'EPOCH',
  'FRAMEEPOCH',
  'GEODCRS',
  'GEODETICCRS',
  'GEODETICDATUM',
  'GEOGCRS',
  'GEOGRAPHICCRS',
  'GEOIDMODEL',
  'ID',
  'INTERPOLATIONCRS',
  'LENGTHUNIT',
  'MEMBER',
  'MERIDIAN',
  'METHOD',
  'MODEL',
  'OPERATIONACCURACY',
  'ORDER',
  'PARAMETER',
  'PARAMETERFILE',
  'PARAMETRICCRS',
  'PARAMETRICDATUM',
  'PARAMETRICUNIT',
  'PDATUM',
  'POINTMOTIONOPERATION',
  'PRIMEM',
  'PRIMEMERIDIAN',
  'PROJCRS',
  'PROJECTEDCRS',
  'PROJECTION',
  'RANGEMEANING',
  'REMARK',
  'SCALEUNIT',
  'SCOPE',
  'SOURCECRS',
  'TARGETCRS',
  'TDATUM',
  'TEMPORALCRS',
  'TEMPORALDATUM',
  'TIMEUNIT',
  'TRANSFORMATION',
  'TRIAXIAL',
  'UNIT',
  'USAGE',
  'VDATUM',
  'VERTCRS',
  'VERTICALCRS',
  'VERTICALDATUM',
  'VERTICALUNIT',
])

export const WKT1_CRS_KEYWORDS = new Set([
  'GEOGCS',
  'PROJCS',
  'GEOCCS',
  'VERT_CS',
  'COMPD_CS',
  'LOCAL_CS',
  'FITTED_CS',
  'SPHEROID',
  'PRIMEM',
  'PROJECTION',
  'VERT_DATUM',
  'COMPD_CS',
  'TOWGS84',
])

export const GEOMETRY_KEYWORD_PATTERN =
  /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)(?:\s+(?:ZM|Z|M))?\b/i

export const DECIMAL_COMMA_PATTERN = /(^|[\s([])-?\d+,\d+($|[\s)\]])/

export const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

export const normalizeWktKeyword = (keyword: string): string => {
  const withoutUnderscores = keyword.replace(/_/g, '')
  return withoutUnderscores.toUpperCase()
}

/** Извлекает ведущее ключевое слово WKT-строки. */
export const extractWktKeyword = (line: string): string | null => {
  const trimmedLine = line.trim()
  const match = trimmedLine.match(/^([A-Za-z][A-Za-z0-9_]*)/)
  return match?.[1] ?? null
}

/** Проверяет, что ключевое слово относится к CRS WKT. */
export const isCrsWktKeyword = (keyword: string): boolean => {
  const normalized = normalizeWktKeyword(keyword)
  return WKT2_CRS_KEYWORDS.has(normalized) || WKT1_CRS_KEYWORDS.has(normalized)
}

/** Проверяет, что строка описывает геометрию OGC Simple Features. */
export const isGeometryWktLine = (line: string): boolean => {
  const trimmedLine = line.trim()
  return GEOMETRY_KEYWORD_PATTERN.test(trimmedLine)
}
