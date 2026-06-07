import type { Geometry, Position } from 'geojson'
import { parse as parseWkt } from 'wellknown'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

/** Поддерживаемые типы геометрии (ISO 19125-1 / OGC Simple Features). */
export const WKT_GEOMETRY_TYPES = [
  'POINT',
  'LINESTRING',
  'POLYGON',
  'MULTIPOINT',
  'MULTILINESTRING',
  'MULTIPOLYGON',
  'GEOMETRYCOLLECTION',
] as const

/** Ключевые слова CRS WKT2 по OGC 18-010r11, §6.6. */
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

/** Ключевые слова CRS WKT1 (ISO 19162 / OGC 01-009) для отклонения. */
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

const GEOMETRY_KEYWORD_PATTERN =
  /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)(?:\s+(?:ZM|Z|M))?\b/i

/** Десятичный разделитель — точка, не запятая (OGC 18-010r11, §6.3.2). */
const DECIMAL_COMMA_PATTERN = /(^|[\s([])-?\d+,\d+($|[\s)\]])/

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

/** Извлекает ведущее ключевое слово WKT-строки. */
export const extractWktKeyword = (line: string): string | null => {
  const match = line.trim().match(/^([A-Za-z][A-Za-z0-9_]*)/)
  return match?.[1] ?? null
}

/** Проверяет, что ключевое слово относится к CRS WKT. */
export const isCrsWktKeyword = (keyword: string): boolean => {
  const normalized = keyword.replace(/_/g, '').toUpperCase()
  return WKT2_CRS_KEYWORDS.has(normalized) || WKT1_CRS_KEYWORDS.has(normalized)
}

/** Проверяет, что строка описывает геометрию OGC Simple Features. */
export const isGeometryWktLine = (line: string): boolean =>
  GEOMETRY_KEYWORD_PATTERN.test(line.trim())

/** latitude/longitude для геометрии WGS84. */
export const isValidWktLatitude = (value: number): boolean => value >= -90 && value <= 90

export const isValidWktLongitude = (value: number): boolean => value >= -180 && value < 180

const assertFiniteCoordinate = (value: number, context: string): void => {
  if (!Number.isFinite(value)) {
    throw toProcessingError(`${context}: недопустимое значение координаты (NaN или Infinity)`)
  }
}

const validatePosition = (position: Position, context: string): void => {
  if (position.length < 2) {
    throw toProcessingError(`${context}: координатная пара должна содержать минимум X и Y`)
  }

  const x = Number(position[0])
  const y = Number(position[1])
  assertFiniteCoordinate(x, `${context}.X`)
  assertFiniteCoordinate(y, `${context}.Y`)

  if (!isValidWktLongitude(x)) {
    throw toProcessingError(`${context}: longitude ${x} вне диапазона [-180, 180)`)
  }
  if (!isValidWktLatitude(y)) {
    throw toProcessingError(`${context}: latitude ${y} вне диапазона [-90, 90]`)
  }
}

/** Рекурсивно проверяет координаты GeoJSON-геометрии после разбора WKT. */
export const validateGeometryCoordinates = (geometry: Geometry, context = 'WKT'): void => {
  switch (geometry.type) {
    case 'Point':
      validatePosition(geometry.coordinates, context)
      return
    case 'LineString':
      geometry.coordinates.forEach((position, index) => {
        validatePosition(position, `${context}[${index}]`)
      })
      return
    case 'Polygon':
      geometry.coordinates.forEach((ring, ringIndex) => {
        ring.forEach((position, index) => {
          validatePosition(position, `${context}.ring${ringIndex}[${index}]`)
        })
      })
      return
    case 'MultiPoint':
      geometry.coordinates.forEach((position, index) => {
        validatePosition(position, `${context}[${index}]`)
      })
      return
    case 'MultiLineString':
      geometry.coordinates.forEach((line, lineIndex) => {
        line.forEach((position, index) => {
          validatePosition(position, `${context}.line${lineIndex}[${index}]`)
        })
      })
      return
    case 'MultiPolygon':
      geometry.coordinates.forEach((polygon, polygonIndex) => {
        polygon.forEach((ring, ringIndex) => {
          ring.forEach((position, index) => {
            validatePosition(
              position,
              `${context}.polygon${polygonIndex}.ring${ringIndex}[${index}]`,
            )
          })
        })
      })
      return
    case 'GeometryCollection':
      geometry.geometries.forEach((part, index) => {
        validateGeometryCoordinates(part, `${context}.part${index}`)
      })
  }
}

/** Проверяет синтаксис WKT-строки геометрии по OGC 18-010r11 §6. */
export const validateGeometryWktLine = (line: string): void => {
  const trimmed = line.trim()
  if (!trimmed) {
    throw toProcessingError('Пустая строка WKT')
  }

  const keyword = extractWktKeyword(trimmed)
  if (!keyword) {
    throw toProcessingError('WKT должен начинаться с ключевого слова типа геометрии')
  }

  if (isCrsWktKeyword(keyword)) {
    throw toProcessingError(
      `Строка содержит CRS WKT (${keyword}); загрузчик принимает геометрию (POINT, LINESTRING, POLYGON и т.д.), не описание системы координат (OGC 18-010r11)`,
    )
  }

  if (!isGeometryWktLine(trimmed)) {
    throw toProcessingError(
      `Неподдерживаемый тип WKT "${keyword}"; допустимы: ${WKT_GEOMETRY_TYPES.join(', ')}`,
    )
  }

  if (trimmed.includes('[') || trimmed.includes(']')) {
    throw toProcessingError(
      'Геометрия WKT должна использовать круглые скобки (); квадратные скобки [] зарезервированы для CRS WKT (OGC 18-010r11, §6.4)',
    )
  }

  if (!trimmed.includes('(')) {
    throw toProcessingError('Геометрия WKT должна содержать координаты в круглых скобках')
  }

  if (DECIMAL_COMMA_PATTERN.test(trimmed)) {
    throw toProcessingError(
      'В числах WKT десятичный разделитель — точка, не запятая (OGC 18-010r11, §6.3.2)',
    )
  }
}

/** Разбирает и валидирует одну строку геометрии WKT. */
export const parseAndValidateGeometryWkt = (line: string): Geometry => {
  validateGeometryWktLine(line)

  let geometry: Geometry | null
  try {
    geometry = parseWkt(line) as Geometry | null
  } catch (error) {
    throw toProcessingError(
      `Ошибка разбора WKT: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!geometry) {
    throw toProcessingError('Не удалось разобрать геометрию WKT')
  }

  validateGeometryCoordinates(geometry)
  return geometry
}

/** Декодирует UTF-8 с удалением BOM (OGC 18-010r11, §6.2). */
export const decodeUtf8WktText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  return new TextDecoder('utf-8').decode(hasBom ? bytes.subarray(3) : bytes)
}

/** Нормализует текст WKT-файла: убирает BOM, комментарии и пустые строки. */
export const extractWktGeometryLines = (text: string): string[] => {
  const lines: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^\u200b|\ufeff/, '')
    if (!line || line.startsWith('#')) continue
    lines.push(line)
  }
  return lines
}

/** Проверяет весь WKT-файл и возвращает разобранные геометрии. */
export const parseAndValidateWktText = (text: string): Geometry[] => {
  const lines = extractWktGeometryLines(text)
  if (lines.length === 0) {
    throw toProcessingError('WKT-файл не содержит строк с геометрией')
  }

  return lines.map((line) => parseAndValidateGeometryWkt(line))
}
