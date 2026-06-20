import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors';
import { getElementLocalName, hasXmlParserError, parseXmlDocument } from '@/lib/xml/parse_xml';

/** Обязательная версия GPX (атрибут version, fixed="1.1"). */
export const GPX_VERSION = '1.1';

const GPX_POINT_TAGS = ['wpt', 'rtept', 'trkpt'] as const;

const GPX_FIX_VALUES = new Set(['none', '2d', '3d', 'dgps', 'pps']);

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message);

/** latitudeType: -90.0 <= value <= 90.0 (WGS84). */
export const isValidGpxLatitude = (value: number): boolean => value >= -90 && value <= 90;

/** longitudeType: -180.0 <= value < 180.0 (WGS84). */
export const isValidGpxLongitude = (value: number): boolean => value >= -180 && value < 180;

/** degreesType: 0.0 <= value < 360.0. */
export const isValidGpxDegrees = (value: number): boolean => value >= 0 && value < 360;

const trimAttributeValue = (value: string | null): string => {
  let trimmed = '';

  if (value !== null) {
    trimmed = value.trim();
  }

  return trimmed;
};

/** Парсит и проверяет координату lat/lon для wptType. */
export const parseGpxCoordinate = ({
  raw,
  kind,
  context,
}: {
  raw: string | null;
  kind: 'lat' | 'lon';
  context: string;
}): number => {
  if (raw === null) {
    throw toProcessingError(`${context}: отсутствует обязательный атрибут ${kind}`);
  }

  const trimmedRaw = raw.trim();
  if (trimmedRaw === '') {
    throw toProcessingError(`${context}: отсутствует обязательный атрибут ${kind}`);
  }

  const value = Number(trimmedRaw);
  if (!Number.isFinite(value)) {
    throw toProcessingError(`${context}: атрибут ${kind}="${raw}" не является числом`);
  }

  if (kind === 'lat' && !isValidGpxLatitude(value)) {
    throw toProcessingError(`${context}: latitude ${value} вне диапазона [-90, 90] (WGS84)`);
  }

  if (kind === 'lon' && !isValidGpxLongitude(value)) {
    throw toProcessingError(`${context}: longitude ${value} вне диапазона [-180, 180) (WGS84)`);
  }

  return value;
};

/** Возвращает элементы GPX по localName независимо от namespace. */
export const getGpxElementsByLocalName = (
  root: Element | Document,
  localName: string,
): Element[] => {
  const elements: Element[] = [];
  const nodeList = root.getElementsByTagNameNS('*', localName);

  for (let index = 0; index < nodeList.length; index += 1) {
    const element = nodeList.item(index);
    if (element) {
      elements.push(element);
    }
  }

  return elements;
};

const validateGpxFixAttribute = (fix: string | null, context: string): void => {
  if (fix !== null && fix !== '') {
    if (!GPX_FIX_VALUES.has(fix)) {
      throw toProcessingError(
        `${context}: fix="${fix}" недопустим; ожидается one of none|2d|3d|dgps|pps`,
      );
    }
  }
};

const validateGpxMagvarAttribute = (magvar: string | null, context: string): void => {
  const trimmedMagvar = trimAttributeValue(magvar);

  if (trimmedMagvar !== '') {
    const value = Number(trimmedMagvar);
    const isFiniteValue = Number.isFinite(value);
    const isValidValue = isValidGpxDegrees(value);

    if (!isFiniteValue || !isValidValue) {
      throw toProcessingError(`${context}: magvar ${magvar} вне диапазона [0, 360)`);
    }
  }
};

const validateGpxPointElement = (element: Element, tag: (typeof GPX_POINT_TAGS)[number]): void => {
  const context = `<${tag}>`;
  const lat = element.getAttribute('lat');
  const lon = element.getAttribute('lon');
  const fix = element.getAttribute('fix');
  const magvar = element.getAttribute('magvar');

  parseGpxCoordinate({ raw: lat, kind: 'lat', context });
  parseGpxCoordinate({ raw: lon, kind: 'lon', context });
  validateGpxFixAttribute(fix, context);
  validateGpxMagvarAttribute(magvar, context);
};

const validateGpxPointTag = (root: Element, tag: (typeof GPX_POINT_TAGS)[number]): void => {
  const elements = getGpxElementsByLocalName(root, tag);

  for (let index = 0; index < elements.length; index += 1) {
    validateGpxPointElement(elements[index], tag);
  }
};

const validatePointElements = (root: Element): void => {
  for (const tag of GPX_POINT_TAGS) {
    validateGpxPointTag(root, tag);
  }
};

const validateBoundsElements = (root: Element): void => {
  const boundsElements = getGpxElementsByLocalName(root, 'bounds');

  for (let index = 0; index < boundsElements.length; index += 1) {
    const bounds = boundsElements[index];
    const minLat = bounds.getAttribute('minlat');
    const minLon = bounds.getAttribute('minlon');
    const maxLat = bounds.getAttribute('maxlat');
    const maxLon = bounds.getAttribute('maxlon');

    parseGpxCoordinate({
      raw: minLat,
      kind: 'lat',
      context: '<bounds minlat>',
    });
    parseGpxCoordinate({
      raw: minLon,
      kind: 'lon',
      context: '<bounds minlon>',
    });
    parseGpxCoordinate({
      raw: maxLat,
      kind: 'lat',
      context: '<bounds maxlat>',
    });
    parseGpxCoordinate({
      raw: maxLon,
      kind: 'lon',
      context: '<bounds maxlon>',
    });
  }
};

const hasGpxGeometry = (root: Element): boolean => {
  let hasPoints = false;

  for (const tag of GPX_POINT_TAGS) {
    if (!hasPoints) {
      const elements = getGpxElementsByLocalName(root, tag);
      if (elements.length > 0) {
        hasPoints = true;
      }
    }
  }

  return hasPoints;
};

const assertGpxCreator = (root: Element): void => {
  const creatorRaw = root.getAttribute('creator');
  const creator = trimAttributeValue(creatorRaw);

  if (creator === '') {
    throw toProcessingError('Атрибут creator обязателен для элемента <gpx>');
  }
};

const assertGpxVersion = (root: Element): void => {
  const version = root.getAttribute('version');

  if (version === null || version === '') {
    throw toProcessingError('Атрибут version обязателен для элемента <gpx>');
  }

  if (version === GPX_VERSION) {
    return;
  }

  throw toProcessingError(`Версия GPX должна быть ${GPX_VERSION}, получена "${version}"`);
};

const assertGpxRootElement = (root: Element | null): Element => {
  if (root === null) {
    throw toProcessingError('Корневой элемент GPX должен быть <gpx>');
  }

  if (getElementLocalName(root) === 'gpx') {
    return root;
  }

  throw toProcessingError('Корневой элемент GPX должен быть <gpx>');
};

/** Проверяет XML-документ GPX 1.1 по схеме Topografix. */
export const validateGpxDocument = (doc: Document): void => {
  if (hasXmlParserError(doc)) {
    throw toProcessingError('Ошибка чтения XML');
  }

  const root = assertGpxRootElement(doc.documentElement);
  assertGpxVersion(root);
  assertGpxCreator(root);
  validatePointElements(root);
  validateBoundsElements(root);

  if (!hasGpxGeometry(root)) {
    throw toProcessingError('GPX не содержит waypoints, route points или track points');
  }
};

/** Проверяет текст GPX 1.1 (парсинг + validateGpxDocument). */
export const validateGpxText = (text: string): Document => {
  const doc = parseXmlDocument(text);
  validateGpxDocument(doc);
  return doc;
};
