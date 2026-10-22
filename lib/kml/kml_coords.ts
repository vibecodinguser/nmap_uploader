import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

const KML_NAMESPACE_SLASH = String.fromCharCode(47)
export const KML_NAMESPACE = [
  'ht',
  'tp',
  ':',
  KML_NAMESPACE_SLASH,
  KML_NAMESPACE_SLASH,
  'www.opengis.net/kml/2.2',
].join('')

export const KML_ROOT_CHILD_TAGS = [
  'Document',
  'Folder',
  'Placemark',
  'NetworkLink',
  'NetworkLinkControl',
] as const

export const KML_LON_LAT_PARENT_TAGS = ['Location', 'LookAt', 'Camera'] as const

export const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

/** Возвращает элементы KML по localName независимо от namespace. */
export const getKmlElementsByLocalName = (
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

/** longitude для WGS84 (Annex B, geodetic longitude). */
export const isValidKmlLongitude = (value: number): boolean => value >= -180 && value < 180

/** latitude для WGS84 (Annex B, geodetic latitude). */
export const isValidKmlLatitude = (value: number): boolean => value >= -90 && value <= 90

export const assertFiniteCoordinate = (value: number, context: string): void => {
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

const trimCommaSeparatedParts = (token: string): string[] => {
  const rawParts = token.split(',')
  const parts: string[] = []
  for (const part of rawParts) {
    parts.push(part.trim())
  }
  return parts
}

const parseKmlCoordinateToken = (token: string, context: string): [number, number] => {
  const parts = trimCommaSeparatedParts(token)
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

  return [longitude, latitude]
}

/**
 * Разбирает kml:coordinates: кортежи lon,lat[,alt], разделённые пробелами (§10.3, §6.3).
 */
export const parseKmlCoordinateTuples = (raw: string, context: string): Array<[number, number]> => {
  const trimmed = raw.trim()
  const tuples: Array<[number, number]> = []

  if (trimmed) {
    for (const token of trimmed.split(/\s+/)) {
      if (token) {
        tuples.push(parseKmlCoordinateToken(token, context))
      }
    }
  }

  return tuples
}
