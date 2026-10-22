import type { Geometry } from 'geojson'
import { parse as parseWkt } from 'wellknown'
import { validateGeometryCoordinates } from './wkt_coords'
import {
  DECIMAL_COMMA_PATTERN,
  extractWktKeyword,
  isCrsWktKeyword,
  isGeometryWktLine,
  toProcessingError,
  WKT_GEOMETRY_TYPES,
} from './wkt_keywords'

export * from './wkt_coords'
export * from './wkt_keywords'

const ERR_MISSING_GEOMETRY_KEYWORD = [
  'WKT должен начинаться с ключевого слова типа геометрии',
].join('')
const ERR_SQUARE_BRACKETS_IN_GEOMETRY = [
  'Геометрия WKT должна использовать круглые скобки ();',
  'квадратные скобки [] зарезервированы для CRS WKT (OGC 18-010r11, §6.4)',
].join(' ')
const ERR_MISSING_PARENTHESES = [
  'Геометрия WKT должна содержать координаты в круглых скобках',
].join('')
const ERR_DECIMAL_COMMA = [
  'В числах WKT десятичный разделитель — точка,',
  'не запятая (OGC 18-010r11, §6.3.2)',
].join(' ')

const assertNonEmptyWktLine = (trimmed: string): void => {
  if (!trimmed) {
    throw toProcessingError('Пустая строка WKT')
  }
}

const assertGeometryKeyword = (trimmed: string): string => {
  const keyword = extractWktKeyword(trimmed)
  if (keyword) {
    return keyword
  }
  throw toProcessingError(ERR_MISSING_GEOMETRY_KEYWORD)
}

const assertNotCrsWkt = (keyword: string): void => {
  if (isCrsWktKeyword(keyword)) {
    const crsWktMessageParts = [
      `Строка содержит CRS WKT (${keyword}); загрузчик принимает геометрию`,
      '(POINT, LINESTRING, POLYGON и т.д.), не описание системы координат (OGC 18-010r11)',
    ]
    throw toProcessingError(crsWktMessageParts.join(' '))
  }
}

const assertSupportedGeometryWkt = (trimmed: string, keyword: string): void => {
  if (isGeometryWktLine(trimmed)) {
    return
  }
  const allowedTypes = WKT_GEOMETRY_TYPES.join(', ')
  throw toProcessingError(`Неподдерживаемый тип WKT "${keyword}"; допустимы: ${allowedTypes}`)
}

const assertRoundParenthesesOnly = (trimmed: string): void => {
  if (trimmed.includes('[') || trimmed.includes(']')) {
    throw toProcessingError(ERR_SQUARE_BRACKETS_IN_GEOMETRY)
  }
}

const assertHasCoordinateParentheses = (trimmed: string): void => {
  if (!trimmed.includes('(')) {
    throw toProcessingError(ERR_MISSING_PARENTHESES)
  }
}

const assertDecimalPointSeparator = (trimmed: string): void => {
  if (DECIMAL_COMMA_PATTERN.test(trimmed)) {
    throw toProcessingError(ERR_DECIMAL_COMMA)
  }
}

/** Проверяет синтаксис WKT-строки геометрии по OGC 18-010r11 §6. */
export const validateGeometryWktLine = (line: string): void => {
  const trimmed = line.trim()
  assertNonEmptyWktLine(trimmed)

  const keyword = assertGeometryKeyword(trimmed)
  assertNotCrsWkt(keyword)
  assertSupportedGeometryWkt(trimmed, keyword)
  assertRoundParenthesesOnly(trimmed)
  assertHasCoordinateParentheses(trimmed)
  assertDecimalPointSeparator(trimmed)
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

/** Разбирает и валидирует одну строку геометрии WKT. */
export const parseAndValidateGeometryWkt = (line: string): Geometry => {
  validateGeometryWktLine(line)

  let geometry: Geometry | null
  try {
    geometry = parseWkt(line) as Geometry | null
  } catch (error) {
    const message = getErrorMessage(error)
    throw toProcessingError(`Ошибка разбора WKT: ${message}`)
  }

  if (geometry) {
    validateGeometryCoordinates(geometry)
    return geometry
  }

  throw toProcessingError('Не удалось разобрать геометрию WKT')
}

const hasUtf8Bom = (bytes: Uint8Array): boolean => {
  if (bytes.length >= 3) {
    return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  }
  return false
}

/** Декодирует UTF-8 с удалением BOM (OGC 18-010r11, §6.2). */
export const decodeUtf8WktText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const payload = hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes
  const decoder = new TextDecoder('utf-8')
  return decoder.decode(payload)
}

const stripLeadingInvisibleChars = (line: string): string => {
  return line.replace(/^\u200b|\ufeff/, '')
}

const isWktGeometryLine = (line: string): boolean => {
  return line.length > 0 && !line.startsWith('#')
}

/** Нормализует WKT-файл: убирает BOM, комментарии и пустые строки. */
export const extractWktGeometryLines = (text: string): string[] => {
  const lines: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmedLine = rawLine.trim()
    const line = stripLeadingInvisibleChars(trimmedLine)
    if (isWktGeometryLine(line)) {
      lines.push(line)
    }
  }
  return lines
}

/** Проверяет весь WKT-файл и возвращает разобранные геометрии. */
export const parseAndValidateWktText = (text: string): Geometry[] => {
  const lines = extractWktGeometryLines(text)
  if (lines.length === 0) {
    throw toProcessingError('WKT-файл не содержит строк с геометрией')
  }

  const geometries: Geometry[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const geometry = parseAndValidateGeometryWkt(lines[index])
    geometries.push(geometry)
  }

  return geometries
}
