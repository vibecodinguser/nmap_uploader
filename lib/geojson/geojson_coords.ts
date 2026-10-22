import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

export const toProcessingError = (message: string): ProcessingError =>
  new ProcessingError(ERR_SHAPEFILE, message)

export const readStringMember = (value: object, key: string, context: string): string => {
  const record = value as Record<string, unknown>
  const member = record[key]

  if (typeof member !== 'string') {
    throw toProcessingError(`${context}: недопустимый type; ожидается строка RFC 7946 §1.4`)
  }

  return member
}

/** longitude WGS84 (RFC 7946, §4). */
export const isValidGeoJsonLongitude = (value: number): boolean => value >= -180 && value <= 180

/** latitude WGS84 (RFC 7946, §4). */
export const isValidGeoJsonLatitude = (value: number): boolean => value >= -90 && value <= 90

export const assertFiniteNumber = (value: number, context: string): void => {
  if (!Number.isFinite(value)) {
    throw toProcessingError(`${context}: недопустимое число (NaN или Infinity)`)
  }
}

/** Проверяет Position: [lon, lat] или [lon, lat, alt] (RFC 7946, §3.1.1). */
export const validateGeoJsonPosition = (position: unknown, context: string): void => {
  if (!Array.isArray(position)) {
    throw toProcessingError(`${context}: position должна быть массивом чисел`)
  }

  if (position.length < 2) {
    throw toProcessingError(`${context}: position должна содержать минимум longitude и latitude`)
  }

  if (position.length > 3) {
    throw toProcessingError(
      `${context}: position не должна содержать более 3 элементов (RFC 7946, §3.1.1)`,
    )
  }

  const longitude = Number(position[0])
  const latitude = Number(position[1])
  assertFiniteNumber(longitude, `${context}.longitude`)
  assertFiniteNumber(latitude, `${context}.latitude`)

  if (!isValidGeoJsonLongitude(longitude)) {
    throw toProcessingError(`${context}: longitude ${longitude} вне диапазона [-180, 180]`)
  }
  if (!isValidGeoJsonLatitude(latitude)) {
    throw toProcessingError(`${context}: latitude ${latitude} вне диапазона [-90, 90]`)
  }

  if (position.length === 3) {
    const altitude = Number(position[2])
    assertFiniteNumber(altitude, `${context}.altitude`)
  }
}

export const validatePositionList = (positions: unknown, context: string): void => {
  if (!Array.isArray(positions)) {
    throw toProcessingError(`${context}: coordinates должны быть массивом позиций`)
  }

  for (let index = 0; index < positions.length; index += 1) {
    validateGeoJsonPosition(positions[index], `${context}[${index}]`)
  }
}

export const rejectLegacyCrs = (value: object, context: string): void => {
  if ('crs' in value) {
    throw toProcessingError(
      `${context}: член "crs" удалён из GeoJSON (RFC 7946, §4); используйте WGS 84`,
    )
  }
}

/** Проверяет bbox: длина 2*n, n=2 или 3 (RFC 7946, §5). */
export const validateGeoJsonBbox = (bbox: unknown, context: string): void => {
  if (!Array.isArray(bbox)) {
    throw toProcessingError(`${context}: bbox должен быть массивом чисел`)
  }

  if (bbox.length !== 4 && bbox.length !== 6) {
    throw toProcessingError(`${context}: bbox должен содержать 4 или 6 чисел (RFC 7946, §5)`)
  }

  for (let index = 0; index < bbox.length; index += 1) {
    const value = bbox[index]
    const numericValue = Number(value)
    assertFiniteNumber(numericValue, `${context}[${index}]`)
  }
}

export const validateOptionalBbox = (bbox: unknown, context: string): void => {
  if (bbox != null) {
    validateGeoJsonBbox(bbox, context)
  }
}
