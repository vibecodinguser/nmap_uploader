import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

/** Возвращает localName элемента (DOM / @xmldom/xmldom). */
export const getElementLocalName = (element: Element): string => {
  if (element.localName) return element.localName
  const nodeName = element.nodeName
  const colonIndex = nodeName.indexOf(':')
  return colonIndex === -1 ? nodeName : nodeName.slice(colonIndex + 1)
}

/** Проверяет наличие ошибки парсинга XML. */
export const hasXmlParserError = (doc: Document): boolean => {
  if (typeof doc.querySelector === 'function') {
    return Boolean(doc.querySelector('parsererror'))
  }

  const errors = doc.getElementsByTagName('parsererror')
  return errors.length > 0
}

/** Парсит XML-текст и выбрасывает ProcessingError при синтаксической ошибке. */
export const parseXmlDocument = (text: string): Document => {
  try {
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    if (hasXmlParserError(doc)) {
      throw new ProcessingError(ERR_SHAPEFILE, 'Ошибка чтения XML')
    }
    return doc
  } catch (error) {
    if (error instanceof ProcessingError) throw error
    throw new ProcessingError(ERR_SHAPEFILE, 'Ошибка чтения XML')
  }
}
