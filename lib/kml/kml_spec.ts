import JSZip from 'jszip'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import { getElementLocalName, hasXmlParserError, parseXmlDocument } from '@/lib/xml/parse_xml'

/** Целевой namespace KML 2.2 (OGC 12-007r2, Table 1). */
export const KML_NAMESPACE = 'http://www.opengis.net/kml/2.2'

/** Дочерние элементы корня kml (§7.1). */
const KML_ROOT_CHILD_TAGS = [
  'Document',
  'Folder',
  'Placemark',
  'NetworkLink',
  'NetworkLinkControl',
] as const

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

/** Возвращает элементы KML по localName независимо от namespace. */
export const getKmlElementsByLocalName = (
  root: Element | Document,
  localName: string,
): Element[] => {
  const elements: Element[] = []
  const nodeList = root.getElementsByTagNameNS('*', localName)
  for (let index = 0; index < nodeList.length; index += 1) {
    const element = nodeList.item(index)
    if (element) elements.push(element)
  }
  return elements
}

/** longitude для WGS84 (Annex B, geodetic longitude). */
export const isValidKmlLongitude = (value: number): boolean => value >= -180 && value < 180

/** latitude для WGS84 (Annex B, geodetic latitude). */
export const isValidKmlLatitude = (value: number): boolean => value >= -90 && value <= 90

const assertFiniteCoordinate = (value: number, context: string): void => {
  if (!Number.isFinite(value)) {
    throw toProcessingError(`${context}: недопустимое значение координаты (NaN или Infinity)`)
  }
}

/** Проверяет пару lon/lat. */
export const validateKmlLonLat = ({
  longitude,
  latitude,
  context,
}: {
  longitude: number
  latitude: number
  context: string
}): void => {
  assertFiniteCoordinate(longitude, `${context}.longitude`)
  assertFiniteCoordinate(latitude, `${context}.latitude`)

  if (!isValidKmlLongitude(longitude)) {
    throw toProcessingError(`${context}: longitude ${longitude} вне диапазона [-180, 180)`)
  }
  if (!isValidKmlLatitude(latitude)) {
    throw toProcessingError(`${context}: latitude ${latitude} вне диапазона [-90, 90]`)
  }
}

/**
 * Разбирает kml:coordinates: кортежи lon,lat[,alt], разделённые пробелами (§10.3, §6.3).
 */
export const parseKmlCoordinateTuples = (raw: string, context: string): Array<[number, number]> => {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const tuples: Array<[number, number]> = []
  for (const token of trimmed.split(/\s+/)) {
    if (!token) continue

    const parts = token.split(',').map((part) => part.trim())
    if (parts.length < 2) {
      throw toProcessingError(
        `${context}: координаты должны быть в формате lon,lat[,alt] (OGC KML 2.2)`,
      )
    }

    const longitude = Number(parts[0])
    const latitude = Number(parts[1])
    validateKmlLonLat({ longitude, latitude, context })

    if (parts.length > 2) {
      const altitude = Number(parts[2])
      assertFiniteCoordinate(altitude, `${context}.altitude`)
    }

    tuples.push([longitude, latitude])
  }

  return tuples
}

const validateCoordinatesElements = (root: Element): void => {
  for (const coordinates of getKmlElementsByLocalName(root, 'coordinates')) {
    const text = coordinates.textContent ?? ''
    parseKmlCoordinateTuples(text, '<coordinates>')
  }
}

/** Проверяет kml:Location и элементы с отдельными longitude/latitude. */
const validateLonLatElements = (root: Element): void => {
  for (const parentTag of ['Location', 'LookAt', 'Camera']) {
    for (const parent of getKmlElementsByLocalName(root, parentTag)) {
      const lonEl = getKmlElementsByLocalName(parent, 'longitude')[0]
      const latEl = getKmlElementsByLocalName(parent, 'latitude')[0]
      if (!lonEl || !latEl) continue

      const longitude = Number(lonEl.textContent?.trim())
      const latitude = Number(latEl.textContent?.trim())
      validateKmlLonLat({ longitude, latitude, context: `<${parentTag}>` })
    }
  }
}

const hasKmlGeometry = (root: Element): boolean => {
  if (getKmlElementsByLocalName(root, 'coordinates').length > 0) return true

  for (const parentTag of ['Location', 'LookAt', 'Camera']) {
    for (const parent of getKmlElementsByLocalName(root, parentTag)) {
      const hasLon = getKmlElementsByLocalName(parent, 'longitude').length > 0
      const hasLat = getKmlElementsByLocalName(parent, 'latitude').length > 0
      if (hasLon && hasLat) return true
    }
  }

  return false
}

const validateKmlNamespace = (root: Element): void => {
  const xmlns = root.getAttribute('xmlns')
  if (!xmlns) return

  if (xmlns !== KML_NAMESPACE) {
    throw toProcessingError(
      `Некорректный xmlns KML: ожидался "${KML_NAMESPACE}", получен "${xmlns}"`,
    )
  }
}

const validateKmlRootStructure = (root: Element): void => {
  const hasRootChild = KML_ROOT_CHILD_TAGS.some(
    (tag) => getKmlElementsByLocalName(root, tag).length > 0,
  )

  if (!hasRootChild) {
    throw toProcessingError(
      'Корневой элемент <kml> должен содержать Document, Folder, Placemark или NetworkLink (OGC 12-007r2, §7.1)',
    )
  }
}

/** Проверяет XML-документ KML по OGC 12-007r2. */
export const validateKmlDocument = (doc: Document): void => {
  if (hasXmlParserError(doc)) {
    throw toProcessingError('Ошибка чтения XML')
  }

  const root = doc.documentElement
  if (!root || getElementLocalName(root) !== 'kml') {
    throw toProcessingError('Корневой элемент KML должен быть <kml>')
  }

  validateKmlNamespace(root)
  validateKmlRootStructure(root)
  validateCoordinatesElements(root)
  validateLonLatElements(root)

  if (!hasKmlGeometry(root)) {
    throw toProcessingError('KML не содержит геометрии (coordinates, Location, LookAt или Camera)')
  }
}

/** Парсит и проверяет текст KML. */
export const validateKmlText = (text: string): Document => {
  const doc = parseXmlDocument(text)
  validateKmlDocument(doc)
  return doc
}

const listZipEntries = (zip: JSZip): string[] =>
  Object.keys(zip.files).filter((name) => !zip.files[name]?.dir)

/** Выбирает главный KML в KMZ: сначала на корневом уровне (§Annex C). */
export const selectKmzMainKmlEntry = (entries: string[]): string | undefined => {
  const normalized = entries
    .filter((name) => !name.startsWith('__MACOSX/'))
    .map((name) => name.replace(/\\/g, '/'))

  const rootKml = normalized.filter(
    (name) => name.toLowerCase().endsWith('.kml') && !name.includes('/'),
  )
  if (rootKml.length > 0) return rootKml[0]

  return normalized.find((name) => name.toLowerCase().endsWith('.kml'))
}

/** Читает и валидирует KML или KMZ (OGC 12-007r2, Annex C). */
export const readValidatedKmlFromBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const isZip = buffer.byteLength >= 4 && new DataView(buffer).getUint32(0, false) === 0x504b0304

  if (!isZip) {
    const text = new TextDecoder('utf-8').decode(buffer)
    validateKmlText(text)
    return text
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch (error) {
    throw toProcessingError(
      `Ошибка чтения KMZ (ZIP): ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const entries = listZipEntries(zip)
  if (entries.length === 0) {
    throw toProcessingError('KMZ-архив пуст')
  }

  const kmlName = selectKmzMainKmlEntry(entries)
  if (!kmlName) {
    throw toProcessingError('В KMZ-архиве отсутствует KML-файл')
  }

  const text = (await zip.file(kmlName)?.async('text')) ?? ''
  if (!text.trim()) {
    throw toProcessingError(`KML-файл "${kmlName}" в KMZ пуст`)
  }

  validateKmlText(text)
  return text
}
