import type {
  Geometry,
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson';
import { parse as parseWkt } from 'wellknown';
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors';

/** Поддерживаемые типы геометрии (ISO 19125-1 / OGC Simple Features). */
export const WKT_GEOMETRY_TYPES = [
  'POINT',
  'LINESTRING',
  'POLYGON',
  'MULTIPOINT',
  'MULTILINESTRING',
  'MULTIPOLYGON',
  'GEOMETRYCOLLECTION',
] as const;

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
]);

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
]);

const GEOMETRY_KEYWORD_PATTERN =
  /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)(?:\s+(?:ZM|Z|M))?\b/i;

/** Десятичный разделитель — точка, не запятая (OGC 18-010r11, §6.3.2). */
const DECIMAL_COMMA_PATTERN = /(^|[\s([])-?\d+,\d+($|[\s)\]])/;

const ERR_FINITE_COORDINATE = 'недопустимое значение координаты (NaN или Infinity)';
const ERR_POSITION_MIN_XY = 'координатная пара должна содержать минимум X и Y';
const ERR_MISSING_GEOMETRY_KEYWORD = [
  'WKT должен начинаться с ключевого слова типа геометрии',
].join('');
const ERR_SQUARE_BRACKETS_IN_GEOMETRY = [
  'Геометрия WKT должна использовать круглые скобки ();',
  'квадратные скобки [] зарезервированы для CRS WKT (OGC 18-010r11, §6.4)',
].join(' ');
const ERR_MISSING_PARENTHESES = [
  'Геометрия WKT должна содержать координаты в круглых скобках',
].join('');
const ERR_DECIMAL_COMMA = [
  'В числах WKT десятичный разделитель — точка,',
  'не запятая (OGC 18-010r11, §6.3.2)',
].join(' ');

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message);

const normalizeWktKeyword = (keyword: string): string => {
  const withoutUnderscores = keyword.replace(/_/g, '');
  return withoutUnderscores.toUpperCase();
};

/** Извлекает ведущее ключевое слово WKT-строки. */
export const extractWktKeyword = (line: string): string | null => {
  const trimmedLine = line.trim();
  const match = trimmedLine.match(/^([A-Za-z][A-Za-z0-9_]*)/);
  return match?.[1] ?? null;
};

/** Проверяет, что ключевое слово относится к CRS WKT. */
export const isCrsWktKeyword = (keyword: string): boolean => {
  const normalized = normalizeWktKeyword(keyword);
  return WKT2_CRS_KEYWORDS.has(normalized) || WKT1_CRS_KEYWORDS.has(normalized);
};

/** Проверяет, что строка описывает геометрию OGC Simple Features. */
export const isGeometryWktLine = (line: string): boolean => {
  const trimmedLine = line.trim();
  return GEOMETRY_KEYWORD_PATTERN.test(trimmedLine);
};

/** latitude/longitude для геометрии WGS84. */
export const isValidWktLatitude = (value: number): boolean => value >= -90 && value <= 90;

export const isValidWktLongitude = (value: number): boolean => value >= -180 && value < 180;

const assertFiniteCoordinate = (value: number, context: string): void => {
  if (Number.isFinite(value)) {
    return;
  }

  throw toProcessingError(`${context}: ${ERR_FINITE_COORDINATE}`);
};

const validatePosition = (position: Position, context: string): void => {
  if (position.length < 2) {
    throw toProcessingError(`${context}: ${ERR_POSITION_MIN_XY}`);
  }

  const x = Number(position[0]);
  const y = Number(position[1]);
  assertFiniteCoordinate(x, `${context}.X`);
  assertFiniteCoordinate(y, `${context}.Y`);

  if (!isValidWktLongitude(x)) {
    throw toProcessingError(`${context}: longitude ${x} вне диапазона [-180, 180)`);
  }
  if (!isValidWktLatitude(y)) {
    throw toProcessingError(`${context}: latitude ${y} вне диапазона [-90, 90]`);
  }
};

const validatePositionList = (positions: Position[], context: string): void => {
  for (let index = 0; index < positions.length; index += 1) {
    validatePosition(positions[index], `${context}[${index}]`);
  }
};

const validatePolygonRings = (rings: Position[][], ringContextPrefix: string): void => {
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    validatePositionList(rings[ringIndex], `${ringContextPrefix}${ringIndex}`);
  }
};

const validatePointGeometry = (geom: Point, context: string): void => {
  validatePosition(geom.coordinates, context);
};

const validateLineStringGeometry = (geom: LineString, context: string): void => {
  validatePositionList(geom.coordinates, context);
};

const validateMultiPointGeometry = (geom: MultiPoint, context: string): void => {
  validatePositionList(geom.coordinates, context);
};

const validateMultiLineStringGeometry = (geom: MultiLineString, context: string): void => {
  const lines = geom.coordinates;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    validatePositionList(lines[lineIndex], `${context}.line${lineIndex}`);
  }
};

const validatePolygonGeometry = (geom: Polygon, context: string): void => {
  validatePolygonRings(geom.coordinates, `${context}.ring`);
};

const validateMultiPolygonGeometry = (geom: MultiPolygon, context: string): void => {
  const polygons = geom.coordinates;

  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex += 1) {
    validatePolygonRings(polygons[polygonIndex], `${context}.polygon${polygonIndex}.ring`);
  }
};

const validateGeometryCollectionGeometry = (geom: GeometryCollection, context: string): void => {
  const parts = geom.geometries;

  for (let index = 0; index < parts.length; index += 1) {
    validateGeometryCoordinates(parts[index], `${context}.part${index}`);
  }
};

const validateGeometryByType = (
  geometry: Geometry,
  geometryType: string,
  context: string,
): void => {
  switch (geometryType) {
    case 'Point':
      validatePointGeometry(geometry as Point, context);
      break;
    case 'LineString':
      validateLineStringGeometry(geometry as LineString, context);
      break;
    case 'Polygon':
      validatePolygonGeometry(geometry as Polygon, context);
      break;
    case 'MultiPoint':
      validateMultiPointGeometry(geometry as MultiPoint, context);
      break;
    case 'MultiLineString':
      validateMultiLineStringGeometry(geometry as MultiLineString, context);
      break;
    case 'MultiPolygon':
      validateMultiPolygonGeometry(geometry as MultiPolygon, context);
      break;
    case 'GeometryCollection':
      validateGeometryCollectionGeometry(geometry as GeometryCollection, context);
      break;
  }
};

/** Проверяет координаты GeoJSON-геометрии после разбора WKT. */
export const validateGeometryCoordinates = (geometry: Geometry, context = 'WKT'): void => {
  validateGeometryByType(geometry, geometry.type, context);
};

const assertNonEmptyWktLine = (trimmed: string): void => {
  if (trimmed) {
    return;
  }

  throw toProcessingError('Пустая строка WKT');
};

const assertGeometryKeyword = (trimmed: string): string => {
  const keyword = extractWktKeyword(trimmed);
  if (keyword) {
    return keyword;
  }

  throw toProcessingError(ERR_MISSING_GEOMETRY_KEYWORD);
};

const assertNotCrsWkt = (keyword: string): void => {
  if (isCrsWktKeyword(keyword)) {
    const crsWktMessageParts = [
      `Строка содержит CRS WKT (${keyword}); загрузчик принимает геометрию`,
      '(POINT, LINESTRING, POLYGON и т.д.), не описание системы координат (OGC 18-010r11)',
    ];
    const message = crsWktMessageParts.join(' ');
    throw toProcessingError(message);
  }
};

const assertSupportedGeometryWkt = (trimmed: string, keyword: string): void => {
  if (isGeometryWktLine(trimmed)) {
    return;
  }

  const allowedTypes = WKT_GEOMETRY_TYPES.join(', ');
  const message = `Неподдерживаемый тип WKT "${keyword}"; допустимы: ${allowedTypes}`;
  throw toProcessingError(message);
};

const assertRoundParenthesesOnly = (trimmed: string): void => {
  const hasSquareBrackets = trimmed.includes('[') || trimmed.includes(']');
  if (hasSquareBrackets) {
    throw toProcessingError(ERR_SQUARE_BRACKETS_IN_GEOMETRY);
  }
};

const assertHasCoordinateParentheses = (trimmed: string): void => {
  if (trimmed.includes('(')) {
    return;
  }

  throw toProcessingError(ERR_MISSING_PARENTHESES);
};

const assertDecimalPointSeparator = (trimmed: string): void => {
  if (DECIMAL_COMMA_PATTERN.test(trimmed)) {
    throw toProcessingError(ERR_DECIMAL_COMMA);
  }
};

/** Проверяет синтаксис WKT-строки геометрии по OGC 18-010r11 §6. */
export const validateGeometryWktLine = (line: string): void => {
  const trimmed = line.trim();
  assertNonEmptyWktLine(trimmed);

  const keyword = assertGeometryKeyword(trimmed);
  assertNotCrsWkt(keyword);
  assertSupportedGeometryWkt(trimmed, keyword);
  assertRoundParenthesesOnly(trimmed);
  assertHasCoordinateParentheses(trimmed);
  assertDecimalPointSeparator(trimmed);
};

const getErrorMessage = (error: unknown): string => {
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  return message;
};

/** Разбирает и валидирует одну строку геометрии WKT. */
export const parseAndValidateGeometryWkt = (line: string): Geometry => {
  validateGeometryWktLine(line);

  let geometry: Geometry | null;
  try {
    geometry = parseWkt(line) as Geometry | null;
  } catch (error) {
    const message = getErrorMessage(error);
    throw toProcessingError(`Ошибка разбора WKT: ${message}`);
  }

  if (geometry) {
    validateGeometryCoordinates(geometry);
    return geometry;
  }

  throw toProcessingError('Не удалось разобрать геометрию WKT');
};

const hasUtf8Bom = (bytes: Uint8Array): boolean => {
  let result: boolean;
  if (bytes.length >= 3) {
    const isFirstByte = bytes[0] === 0xef;
    const isSecondByte = bytes[1] === 0xbb;
    const isThirdByte = bytes[2] === 0xbf;
    result = isFirstByte && isSecondByte && isThirdByte;
  } else {
    result = false;
  }

  return result;
};

/** Декодирует UTF-8 с удалением BOM (OGC 18-010r11, §6.2). */
export const decodeUtf8WktText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const hasBom = hasUtf8Bom(bytes);
  let payload: Uint8Array;
  if (hasBom) {
    payload = bytes.subarray(3);
  } else {
    payload = bytes;
  }

  const decoder = new TextDecoder('utf-8');
  return decoder.decode(payload);
};

const stripLeadingInvisibleChars = (line: string): string => {
  return line.replace(/^\u200b|\ufeff/, '');
};

const isWktGeometryLine = (line: string): boolean => {
  let result: boolean;
  result = line.length > 0 && !line.startsWith('#');
  return result;
};

/** Нормализует WKT-файл: убирает BOM, комментарии и пустые строки. */
export const extractWktGeometryLines = (text: string): string[] => {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();
    const line = stripLeadingInvisibleChars(trimmedLine);
    if (isWktGeometryLine(line)) {
      lines.push(line);
    }
  }
  return lines;
};

/** Проверяет весь WKT-файл и возвращает разобранные геометрии. */
export const parseAndValidateWktText = (text: string): Geometry[] => {
  const lines = extractWktGeometryLines(text);
  if (lines.length === 0) {
    throw toProcessingError('WKT-файл не содержит строк с геометрией');
  }

  const geometries: Geometry[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const geometry = parseAndValidateGeometryWkt(lines[index]);
    geometries.push(geometry);
  }

  return geometries;
};
