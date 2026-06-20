import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors';

const ERR_XML_READ = 'Ошибка чтения XML';

/** Возвращает localName элемента (DOM / @xmldom/xmldom). */
export const getElementLocalName = (element: Element): string => {
  let result: string;
  if (element.localName) {
    result = element.localName;
  } else {
    const nodeName = element.nodeName;
    const colonIndex = nodeName.indexOf(':');
    if (colonIndex === -1) {
      result = nodeName;
    } else {
      result = nodeName.slice(colonIndex + 1);
    }
  }

  return result;
};

/** Проверяет наличие ошибки парсинга XML. */
export const hasXmlParserError = (doc: Document): boolean => {
  const parserErrors = doc.getElementsByTagName('parsererror');
  return parserErrors.length > 0;
};

/** Парсит XML-текст и выбрасывает ProcessingError при синтаксической ошибке. */
export const parseXmlDocument = (text: string): Document => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  if (hasXmlParserError(doc)) {
    throw new ProcessingError(ERR_SHAPEFILE, ERR_XML_READ);
  }

  return doc;
};
