import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import { getElementLocalName, hasXmlParserError, parseXmlDocument } from '@/lib/xml/parse_xml'

/** Обязательная версия GPX (атрибут version, fixed="1.1"). */
export const GPX_VERSION = '1.1'

const GPX_POINT_TAGS = ['wpt', 'rtept', 'trkpt'] as const

const GPX_FIX_VALUES = new Set(['none', '2d', '3d', 'dgps', 'pps'])

const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

/** latitudeType: -90.0 <= value <= 90.0 (WGS84). */
export const isValidGpxLatitude = (value: number): boolean => value >= -90 && value <= 90

/** longitudeType: -180.0 <= value < 180.0 (WGS84). */
export const isValidGpxLongitude = (value: number): boolean => value >= -180 && value < 180

/** degreesType: 0.0 <= value < 360.0. */
export const isValidGpxDegrees = (value: number): boolean => value >= 0 && value < 360

/** Парсит и проверяет координату lat/lon для wptType. */
export const parseGpxCoordinate = ({
  raw,
  kind,
  context,
}: {
  raw: string | null
  kind: 'lat' | 'lon'
  context: string
}): number => {
  if (raw == null || raw.trim() === '') {
    throw toProcessingError(`${context}: отсутствует обязательный атрибут ${kind}`)
  }

  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw toProcessingError(`${context}: атрибут ${kind}="${raw}" не является числом`)
  }

  if (kind === 'lat' && !isValidGpxLatitude(value)) {
    throw toProcessingError(`${context}: latitude ${value} вне диапазона [-90, 90] (WGS84)`)
  }

  if (kind === 'lon' && !isValidGpxLongitude(value)) {
    throw toProcessingError(`${context}: longitude ${value} вне диапазона [-180, 180) (WGS84)`)
  }

  return value
}

/** Возвращает элементы GPX по localName независимо от namespace. */
export const getGpxElementsByLocalName = (
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

const validatePointElements = (root: Element): void => {
  for (const tag of GPX_POINT_TAGS) {
    for (const element of getGpxElementsByLocalName(root, tag)) {
      const context = `<${tag}>`
      parseGpxCoordinate({ raw: element.getAttribute('lat'), kind: 'lat', context })
      parseGpxCoordinate({ raw: element.getAttribute('lon'), kind: 'lon', context })

      const fix = element.getAttribute('fix')
      if (fix && !GPX_FIX_VALUES.has(fix)) {
        throw toProcessingError(
          `${context}: fix="${fix}" недопустим; ожидается one of none|2d|3d|dgps|pps`,
        )
      }

      const magvar = element.getAttribute('magvar')
      if (magvar != null && magvar.trim() !== '') {
        const value = Number(magvar)
        if (!Number.isFinite(value) || !isValidGpxDegrees(value)) {
          throw toProcessingError(`${context}: magvar ${magvar} вне диапазона [0, 360)`)
        }
      }
    }
  }
}

const validateBoundsElements = (root: Element): void => {
  for (const bounds of getGpxElementsByLocalName(root, 'bounds')) {
    parseGpxCoordinate({
      raw: bounds.getAttribute('minlat'),
      kind: 'lat',
      context: '<bounds minlat>',
    })
    parseGpxCoordinate({
      raw: bounds.getAttribute('minlon'),
      kind: 'lon',
      context: '<bounds minlon>',
    })
    parseGpxCoordinate({
      raw: bounds.getAttribute('maxlat'),
      kind: 'lat',
      context: '<bounds maxlat>',
    })
    parseGpxCoordinate({
      raw: bounds.getAttribute('maxlon'),
      kind: 'lon',
      context: '<bounds maxlon>',
    })
  }
}

const hasGpxGeometry = (root: Element): boolean =>
  GPX_POINT_TAGS.some((tag) => getGpxElementsByLocalName(root, tag).length > 0)

/** Проверяет XML-документ GPX 1.1 по схеме Topografix. */
export const validateGpxDocument = (doc: Document): void => {
  if (hasXmlParserError(doc)) {
    throw toProcessingError('Ошибка чтения XML')
  }

  const root = doc.documentElement
  if (!root || getElementLocalName(root) !== 'gpx') {
    throw toProcessingError('Корневой элемент GPX должен быть <gpx>')
  }

  const version = root.getAttribute('version')
  if (!version) {
    throw toProcessingError('Атрибут version обязателен для элемента <gpx>')
  }
  if (version !== GPX_VERSION) {
    throw toProcessingError(`Версия GPX должна быть ${GPX_VERSION}, получена "${version}"`)
  }

  const creator = root.getAttribute('creator')?.trim()
  if (!creator) {
    throw toProcessingError('Атрибут creator обязателен для элемента <gpx>')
  }

  validatePointElements(root)
  validateBoundsElements(root)

  if (!hasGpxGeometry(root)) {
    throw toProcessingError('GPX не содержит waypoints, route points или track points')
  }
}

/** Проверяет текст GPX 1.1 (парсинг + validateGpxDocument). */
export const validateGpxText = (text: string): Document => {
  const doc = parseXmlDocument(text)
  validateGpxDocument(doc)
  return doc
}
