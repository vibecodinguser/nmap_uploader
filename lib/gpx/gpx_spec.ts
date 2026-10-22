import { getElementLocalName, hasXmlParserError, parseXmlDocument } from '@/lib/xml/parse_xml'
import {
  GPX_FIX_VALUES,
  GPX_POINT_TAGS,
  GPX_VERSION,
  getGpxElementsByLocalName,
  isValidGpxDegrees,
  parseGpxCoordinate,
  toProcessingError,
  trimAttributeValue,
} from './gpx_coords'

export * from './gpx_coords'

const validateGpxFixAttribute = (fix: string | null, context: string): void => {
  if (fix !== null && fix !== '') {
    if (!GPX_FIX_VALUES.has(fix)) {
      throw toProcessingError(
        `${context}: fix="${fix}" недопустим; ожидается one of none|2d|3d|dgps|pps`,
      )
    }
  }
}

const validateGpxMagvarAttribute = (magvar: string | null, context: string): void => {
  const trimmedMagvar = trimAttributeValue(magvar)

  if (trimmedMagvar !== '') {
    const value = Number(trimmedMagvar)
    const isFiniteValue = Number.isFinite(value)
    const isValidValue = isValidGpxDegrees(value)

    if (!isFiniteValue || !isValidValue) {
      throw toProcessingError(`${context}: magvar ${magvar} вне диапазона [0, 360)`)
    }
  }
}

const validateGpxPointElement = (element: Element, tag: (typeof GPX_POINT_TAGS)[number]): void => {
  const context = `<${tag}>`
  const lat = element.getAttribute('lat')
  const lon = element.getAttribute('lon')
  const fix = element.getAttribute('fix')
  const magvar = element.getAttribute('magvar')

  parseGpxCoordinate({ raw: lat, kind: 'lat', context })
  parseGpxCoordinate({ raw: lon, kind: 'lon', context })
  validateGpxFixAttribute(fix, context)
  validateGpxMagvarAttribute(magvar, context)
}

const validateGpxPointTag = (root: Element, tag: (typeof GPX_POINT_TAGS)[number]): void => {
  const elements = getGpxElementsByLocalName(root, tag)

  for (let index = 0; index < elements.length; index += 1) {
    validateGpxPointElement(elements[index], tag)
  }
}

const validatePointElements = (root: Element): void => {
  for (const tag of GPX_POINT_TAGS) {
    validateGpxPointTag(root, tag)
  }
}

const validateBoundsElements = (root: Element): void => {
  const boundsElements = getGpxElementsByLocalName(root, 'bounds')

  for (let index = 0; index < boundsElements.length; index += 1) {
    const bounds = boundsElements[index]
    const minLat = bounds.getAttribute('minlat')
    const minLon = bounds.getAttribute('minlon')
    const maxLat = bounds.getAttribute('maxlat')
    const maxLon = bounds.getAttribute('maxlon')

    parseGpxCoordinate({
      raw: minLat,
      kind: 'lat',
      context: '<bounds minlat>',
    })
    parseGpxCoordinate({
      raw: minLon,
      kind: 'lon',
      context: '<bounds minlon>',
    })
    parseGpxCoordinate({
      raw: maxLat,
      kind: 'lat',
      context: '<bounds maxlat>',
    })
    parseGpxCoordinate({
      raw: maxLon,
      kind: 'lon',
      context: '<bounds maxlon>',
    })
  }
}

const hasGpxGeometry = (root: Element): boolean => {
  for (const tag of GPX_POINT_TAGS) {
    const elements = getGpxElementsByLocalName(root, tag)
    if (elements.length > 0) {
      return true
    }
  }
  return false
}

const assertGpxCreator = (root: Element): void => {
  const creatorRaw = root.getAttribute('creator')
  const creator = trimAttributeValue(creatorRaw)

  if (creator === '') {
    throw toProcessingError('Атрибут creator обязателен для элемента <gpx>')
  }
}

const assertGpxVersion = (root: Element): void => {
  const version = root.getAttribute('version')

  if (version === null || version === '') {
    throw toProcessingError('Атрибут version обязателен для элемента <gpx>')
  }

  if (version === GPX_VERSION) {
    return
  }

  throw toProcessingError(`Версия GPX должна быть ${GPX_VERSION}, получена "${version}"`)
}

const assertGpxRootElement = (root: Element | null): Element => {
  if (root === null) {
    throw toProcessingError('Корневой элемент GPX должен быть <gpx>')
  }

  if (getElementLocalName(root) === 'gpx') {
    return root
  }

  throw toProcessingError('Корневой элемент GPX должен быть <gpx>')
}

/** Проверяет XML-документ GPX 1.1 по схеме Topografix. */
export const validateGpxDocument = (doc: Document): void => {
  if (hasXmlParserError(doc)) {
    throw toProcessingError('Ошибка чтения XML')
  }

  const root = assertGpxRootElement(doc.documentElement)
  assertGpxVersion(root)
  assertGpxCreator(root)
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
