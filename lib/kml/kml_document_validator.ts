import { getElementLocalName, hasXmlParserError, parseXmlDocument } from '@/lib/xml/parse_xml'
import {
  getKmlElementsByLocalName,
  KML_LON_LAT_PARENT_TAGS,
  KML_NAMESPACE,
  KML_ROOT_CHILD_TAGS,
  parseKmlCoordinateTuples,
  toProcessingError,
  validateKmlLonLat,
} from './kml_coords'

const validateCoordinatesElements = (root: Element): void => {
  const coordinateElements = getKmlElementsByLocalName(root, 'coordinates')
  for (const coordinates of coordinateElements) {
    const text = coordinates.textContent || ''
    parseKmlCoordinateTuples(text, '<coordinates>')
  }
}

const validateLonLatParent = (parent: Element, parentTag: string): void => {
  const lonElements = getKmlElementsByLocalName(parent, 'longitude')
  const latElements = getKmlElementsByLocalName(parent, 'latitude')
  const lonEl = lonElements[0]
  const latEl = latElements[0]
  if (lonEl && latEl) {
    const lonText = lonEl.textContent?.trim() || ''
    const latText = latEl.textContent?.trim() || ''

    const longitude = Number(lonText)
    const latitude = Number(latText)
    validateKmlLonLat({ longitude, latitude, context: `<${parentTag}>` })
  }
}

const validateLonLatParentTag = (root: Element, parentTag: string): void => {
  const parents = getKmlElementsByLocalName(root, parentTag)
  for (const parent of parents) {
    validateLonLatParent(parent, parentTag)
  }
}

const validateLonLatElements = (root: Element): void => {
  for (const parentTag of KML_LON_LAT_PARENT_TAGS) {
    validateLonLatParentTag(root, parentTag)
  }
}

const parentHasLonLat = (parent: Element): boolean => {
  const lonElements = getKmlElementsByLocalName(parent, 'longitude')
  const latElements = getKmlElementsByLocalName(parent, 'latitude')
  return lonElements.length > 0 && latElements.length > 0
}

const hasLonLatGeometryForTag = (root: Element, parentTag: string): boolean => {
  const parents = getKmlElementsByLocalName(root, parentTag)
  for (const parent of parents) {
    if (parentHasLonLat(parent)) {
      return true
    }
  }
  return false
}

export const hasKmlGeometry = (root: Element): boolean => {
  const coordinateElements = getKmlElementsByLocalName(root, 'coordinates')
  if (coordinateElements.length > 0) {
    return true
  }

  for (const parentTag of KML_LON_LAT_PARENT_TAGS) {
    if (hasLonLatGeometryForTag(root, parentTag)) {
      return true
    }
  }
  return false
}

const validateKmlNamespace = (root: Element): void => {
  const xmlns = root.getAttribute('xmlns')
  if (xmlns && xmlns !== KML_NAMESPACE) {
    throw toProcessingError(
      `Некорректный xmlns KML: ожидался "${KML_NAMESPACE}", получен "${xmlns}"`,
    )
  }
}

const validateKmlRootStructure = (root: Element): void => {
  for (const tag of KML_ROOT_CHILD_TAGS) {
    const elements = getKmlElementsByLocalName(root, tag)
    if (elements.length > 0) {
      return
    }
  }

  throw toProcessingError(
    'Корневой элемент <kml> должен содержать Document, Folder, Placemark или NetworkLink (OGC 12-007r2, §7.1)',
  )
}

/** Проверяет XML-документ KML по OGC 12-007r2. */
export const validateKmlDocument = (doc: Document): void => {
  if (hasXmlParserError(doc)) {
    throw toProcessingError('Ошибка чтения XML')
  }

  const root = doc.documentElement
  const hasValidRoot = root !== null && getElementLocalName(root) === 'kml'
  if (hasValidRoot) {
    validateKmlNamespace(root)
    validateKmlRootStructure(root)
    validateCoordinatesElements(root)
    validateLonLatElements(root)

    if (hasKmlGeometry(root)) {
      return
    }

    throw toProcessingError('KML не содержит геометрии (coordinates, Location, LookAt или Camera)')
  }

  throw toProcessingError('Корневой элемент KML должен быть <kml>')
}

/** Парсит и проверяет текст KML. */
export const validateKmlText = (text: string): Document => {
  const doc = parseXmlDocument(text)
  validateKmlDocument(doc)
  return doc
}
