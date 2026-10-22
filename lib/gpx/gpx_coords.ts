import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

export const GPX_VERSION = '1.1'
export const GPX_POINT_TAGS = ['wpt', 'rtept', 'trkpt'] as const
export const GPX_FIX_VALUES = new Set(['none', '2d', '3d', 'dgps', 'pps'])

export const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

/** latitudeType: -90.0 <= value <= 90.0 (WGS84). */
export const isValidGpxLatitude = (value: number): boolean => value >= -90 && value <= 90

/** longitudeType: -180.0 <= value < 180.0 (WGS84). */
export const isValidGpxLongitude = (value: number): boolean => value >= -180 && value < 180

/** degreesType: 0.0 <= value < 360.0. */
export const isValidGpxDegrees = (value: number): boolean => value >= 0 && value < 360

export const trimAttributeValue = (value: string | null): string => {
  if (value !== null) {
    return value.trim()
  }
  return ''
}

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
  if (raw === null) {
    throw toProcessingError(`${context}: отсутствует обязательный атрибут ${kind}`)
  }

  const trimmedRaw = raw.trim()
  if (trimmedRaw === '') {
    throw toProcessingError(`${context}: отсутствует обязательный атрибут ${kind}`)
  }

  const value = Number(trimmedRaw)
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
    if (element) {
      elements.push(element)
    }
  }

  return elements
}
