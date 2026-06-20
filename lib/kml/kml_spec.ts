import JSZip from 'jszip';
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors';
import { getElementLocalName, hasXmlParserError, parseXmlDocument } from '@/lib/xml/parse_xml';

/** Целевой namespace KML 2.2 (OGC 12-007r2, Table 1). */
const KML_NAMESPACE_SLASH = String.fromCharCode(47);
export const KML_NAMESPACE = [
  'ht',
  'tp',
  ':',
  KML_NAMESPACE_SLASH,
  KML_NAMESPACE_SLASH,
  'www.opengis.net/kml/2.2',
].join('');

/** Дочерние элементы корня kml (§7.1). */
const KML_ROOT_CHILD_TAGS = [
  'Document',
  'Folder',
  'Placemark',
  'NetworkLink',
  'NetworkLinkControl',
] as const;

const KML_LON_LAT_PARENT_TAGS = ['Location', 'LookAt', 'Camera'] as const;

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message);

const getErrorMessage = (error: unknown): string => {
  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  return message;
};

/** Возвращает элементы KML по localName независимо от namespace. */
export const getKmlElementsByLocalName = (
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

/** longitude для WGS84 (Annex B, geodetic longitude). */
export const isValidKmlLongitude = (value: number): boolean => value >= -180 && value < 180;

/** latitude для WGS84 (Annex B, geodetic latitude). */
export const isValidKmlLatitude = (value: number): boolean => value >= -90 && value <= 90;

const assertFiniteCoordinate = (value: number, context: string): void => {
  if (Number.isFinite(value)) {
    return;
  }

  throw toProcessingError(`${context}: недопустимое значение координаты (NaN или Infinity)`);
};

/** Проверяет пару lon/lat. */
export const validateKmlLonLat = ({
  longitude,
  latitude,
  context,
}: {
  longitude: number;
  latitude: number;
  context: string;
}): void => {
  assertFiniteCoordinate(longitude, `${context}.longitude`);
  assertFiniteCoordinate(latitude, `${context}.latitude`);

  if (!isValidKmlLongitude(longitude)) {
    throw toProcessingError(`${context}: longitude ${longitude} вне диапазона [-180, 180)`);
  }
  if (!isValidKmlLatitude(latitude)) {
    throw toProcessingError(`${context}: latitude ${latitude} вне диапазона [-90, 90]`);
  }
};

const trimCommaSeparatedParts = (token: string): string[] => {
  const rawParts = token.split(',');
  const parts: string[] = [];
  for (const part of rawParts) {
    const trimmedPart = part.trim();
    parts.push(trimmedPart);
  }
  return parts;
};

const parseKmlCoordinateToken = (token: string, context: string): [number, number] => {
  const parts = trimCommaSeparatedParts(token);
  if (parts.length < 2) {
    throw toProcessingError(
      `${context}: координаты должны быть в формате lon,lat[,alt] (OGC KML 2.2)`,
    );
  }

  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  validateKmlLonLat({ longitude, latitude, context });

  if (parts.length > 2) {
    const altitude = Number(parts[2]);
    assertFiniteCoordinate(altitude, `${context}.altitude`);
  }

  return [longitude, latitude];
};

/**
 * Разбирает kml:coordinates: кортежи lon,lat[,alt], разделённые пробелами (§10.3, §6.3).
 */
export const parseKmlCoordinateTuples = (raw: string, context: string): Array<[number, number]> => {
  const trimmed = raw.trim();
  const tuples: Array<[number, number]> = [];

  if (trimmed) {
    for (const token of trimmed.split(/\s+/)) {
      if (token) {
        const tuple = parseKmlCoordinateToken(token, context);
        tuples.push(tuple);
      }
    }
  }

  return tuples;
};

const validateCoordinatesElements = (root: Element): void => {
  const coordinateElements = getKmlElementsByLocalName(root, 'coordinates');
  for (const coordinates of coordinateElements) {
    let text = '';
    if (coordinates.textContent) {
      text = coordinates.textContent;
    }
    parseKmlCoordinateTuples(text, '<coordinates>');
  }
};

const validateLonLatParent = (parent: Element, parentTag: string): void => {
  const lonElements = getKmlElementsByLocalName(parent, 'longitude');
  const latElements = getKmlElementsByLocalName(parent, 'latitude');
  const lonEl = lonElements[0];
  const latEl = latElements[0];
  if (lonEl && latEl) {
    let lonText = '';
    let latText = '';
    const lonContent = lonEl.textContent;
    const latContent = latEl.textContent;
    if (lonContent) {
      lonText = lonContent.trim();
    }
    if (latContent) {
      latText = latContent.trim();
    }

    const longitude = Number(lonText);
    const latitude = Number(latText);
    validateKmlLonLat({ longitude, latitude, context: `<${parentTag}>` });
  }
};

const validateLonLatParentTag = (root: Element, parentTag: string): void => {
  const parents = getKmlElementsByLocalName(root, parentTag);
  for (const parent of parents) {
    validateLonLatParent(parent, parentTag);
  }
};

/** Проверяет kml:Location и элементы с отдельными longitude/latitude. */
const validateLonLatElements = (root: Element): void => {
  for (const parentTag of KML_LON_LAT_PARENT_TAGS) {
    validateLonLatParentTag(root, parentTag);
  }
};

const parentHasLonLat = (parent: Element): boolean => {
  const lonElements = getKmlElementsByLocalName(parent, 'longitude');
  const latElements = getKmlElementsByLocalName(parent, 'latitude');
  const hasLon = lonElements.length > 0;
  const hasLat = latElements.length > 0;
  return hasLon && hasLat;
};

const hasLonLatGeometryForTag = (root: Element, parentTag: string): boolean => {
  let hasGeometry = false;
  const parents = getKmlElementsByLocalName(root, parentTag);

  for (const parent of parents) {
    if (!hasGeometry && parentHasLonLat(parent)) {
      hasGeometry = true;
    }
  }

  return hasGeometry;
};

const hasKmlGeometry = (root: Element): boolean => {
  let hasGeometry = false;
  const coordinateElements = getKmlElementsByLocalName(root, 'coordinates');

  if (coordinateElements.length > 0) {
    hasGeometry = true;
  } else {
    for (const parentTag of KML_LON_LAT_PARENT_TAGS) {
      if (!hasGeometry && hasLonLatGeometryForTag(root, parentTag)) {
        hasGeometry = true;
      }
    }
  }

  return hasGeometry;
};

const validateKmlNamespace = (root: Element): void => {
  const xmlns = root.getAttribute('xmlns');

  if (xmlns && xmlns !== KML_NAMESPACE) {
    throw toProcessingError(
      `Некорректный xmlns KML: ожидался "${KML_NAMESPACE}", получен "${xmlns}"`,
    );
  }
};

const validateKmlRootStructure = (root: Element): void => {
  let hasRootChild = false;

  for (const tag of KML_ROOT_CHILD_TAGS) {
    if (!hasRootChild) {
      const elements = getKmlElementsByLocalName(root, tag);
      if (elements.length > 0) {
        hasRootChild = true;
      }
    }
  }

  if (hasRootChild) {
    return;
  }

  throw toProcessingError(
    'Корневой элемент <kml> должен содержать Document, Folder, Placemark или NetworkLink (OGC 12-007r2, §7.1)',
  );
};

/** Проверяет XML-документ KML по OGC 12-007r2. */
export const validateKmlDocument = (doc: Document): void => {
  if (hasXmlParserError(doc)) {
    throw toProcessingError('Ошибка чтения XML');
  }

  const root = doc.documentElement;
  const hasValidRoot = root !== null && getElementLocalName(root) === 'kml';
  if (hasValidRoot) {
    validateKmlNamespace(root);
    validateKmlRootStructure(root);
    validateCoordinatesElements(root);
    validateLonLatElements(root);

    if (hasKmlGeometry(root)) {
      return;
    }

    throw toProcessingError('KML не содержит геометрии (coordinates, Location, LookAt или Camera)');
  }

  throw toProcessingError('Корневой элемент KML должен быть <kml>');
};

/** Парсит и проверяет текст KML. */
export const validateKmlText = (text: string): Document => {
  const doc = parseXmlDocument(text);
  validateKmlDocument(doc);
  return doc;
};

const listZipEntries = (zip: JSZip): string[] => {
  const fileNames = Object.keys(zip.files);
  const entries: string[] = [];

  for (const name of fileNames) {
    const file = zip.files[name];
    if (file) {
      if (file.dir) {
        // skip directories
      } else {
        entries.push(name);
      }
    }
  }

  return entries;
};

const normalizeKmzEntryName = (name: string): string => name.replace(/\\/g, '/');

const isKmlEntryName = (name: string): boolean => {
  const lowerName = name.toLowerCase();
  return lowerName.endsWith('.kml');
};

const normalizeKmzEntries = (entries: string[]): string[] => {
  const normalized: string[] = [];

  for (const name of entries) {
    if (name.startsWith('__MACOSX/')) {
      // skip macOS metadata
    } else {
      const normalizedName = normalizeKmzEntryName(name);
      normalized.push(normalizedName);
    }
  }

  return normalized;
};

const findMainKmlInNormalizedEntries = (normalized: string[]): string | undefined => {
  let rootKml: string | undefined;
  let anyKml: string | undefined;

  for (const name of normalized) {
    if (isKmlEntryName(name)) {
      if (anyKml === undefined) {
        anyKml = name;
      }
      if (name.includes('/')) {
        // nested path
      } else if (rootKml === undefined) {
        rootKml = name;
      }
    }
  }

  let result = rootKml;
  if (result === undefined) {
    result = anyKml;
  }

  return result;
};

/** Выбирает главный KML в KMZ: сначала на корневом уровне (§Annex C). */
export const selectKmzMainKmlEntry = (entries: string[]): string | undefined => {
  const normalized = normalizeKmzEntries(entries);
  return findMainKmlInNormalizedEntries(normalized);
};

/** Читает и валидирует KML или KMZ (OGC 12-007r2, Annex C). */
export const readValidatedKmlFromBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  let isZip = false;
  if (buffer.byteLength >= 4) {
    const view = new DataView(buffer);
    isZip = view.getUint32(0, false) === 0x504b0304;
  }

  let result = '';

  if (isZip) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw toProcessingError(`Ошибка чтения KMZ (ZIP): ${errorMessage}`);
    }

    const entries = listZipEntries(zip);
    if (entries.length === 0) {
      throw toProcessingError('KMZ-архив пуст');
    }

    const kmlName = selectKmzMainKmlEntry(entries);
    if (kmlName) {
      const zipEntry = zip.file(kmlName);
      if (zipEntry) {
        result = await zipEntry.async('text');
      }
      const trimmedResult = result.trim();
      if (trimmedResult) {
        validateKmlText(result);
      } else {
        throw toProcessingError(`KML-файл "${kmlName}" в KMZ пуст`);
      }
    } else {
      throw toProcessingError('В KMZ-архиве отсутствует KML-файл');
    }
  } else {
    const decoder = new TextDecoder('utf-8');
    result = decoder.decode(buffer);
    validateKmlText(result);
  }

  return result;
};
