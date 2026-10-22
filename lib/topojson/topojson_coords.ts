import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import { isValidGeoJsonLatitude, isValidGeoJsonLongitude } from '@/lib/geojson/geojson_spec'

export type TopoJsonTransform = {
  scale: [number, number]
  translate: [number, number]
}

export const toProcessingError = (message: string): ProcessingError => {
  return new ProcessingError(ERR_SHAPEFILE, message)
}

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value === 'object' && value !== null) {
    return !Array.isArray(value)
  }
  return false
}

export const isLength2Array = (value: unknown): value is [unknown, unknown] => {
  return Array.isArray(value) && value.length === 2
}

export const assertFiniteNumber = (value: number, context: string): void => {
  if (!Number.isFinite(value)) {
    throw toProcessingError(`${context}: недопустимое число (NaN или Infinity)`)
  }
}

export const assertInteger32 = (value: number, context: string): void => {
  if (!Number.isInteger(value)) {
    throw toProcessingError(`${context}: квантованная позиция должна быть целым числом`)
  }

  if (value < -2147483648 || value > 2147483647) {
    throw toProcessingError(`${context}: целое число вне диапазона 32-bit signed integer`)
  }
}

/** Проверяет position: минимум 2 числа (§2.1.1). */
export const validateTopoJsonPosition = (
  position: unknown,
  context: string,
  isQuantized: boolean,
): void => {
  if (!Array.isArray(position)) {
    throw toProcessingError(`${context}: position должна быть массивом чисел`)
  }

  if (position.length < 2) {
    throw toProcessingError(`${context}: position должна содержать минимум 2 элемента`)
  }

  const x = Number(position[0])
  const y = Number(position[1])
  assertFiniteNumber(x, `${context}[0]`)
  assertFiniteNumber(y, `${context}[1]`)

  if (isQuantized) {
    assertInteger32(x, `${context}[0]`)
    assertInteger32(y, `${context}[1]`)
  } else {
    if (!isValidGeoJsonLongitude(x)) {
      throw toProcessingError(`${context}[0]: longitude ${x} вне диапазона [-180, 180]`)
    }
    if (!isValidGeoJsonLatitude(y)) {
      throw toProcessingError(`${context}[1]: latitude ${y} вне диапазона [-90, 90]`)
    }
  }
}

/** Проверяет transform (§2.1.2). */
export const validateTopoJsonTransform = (
  transform: unknown,
  context = 'transform',
): TopoJsonTransform => {
  if (isPlainObject(transform)) {
    const obj = transform as { scale?: unknown; translate?: unknown }

    if (isLength2Array(obj.scale)) {
      if (isLength2Array(obj.translate)) {
        const scaleX = Number(obj.scale[0])
        const scaleY = Number(obj.scale[1])
        const translateX = Number(obj.translate[0])
        const translateY = Number(obj.translate[1])
        assertFiniteNumber(scaleX, `${context}.scale[0]`)
        assertFiniteNumber(scaleY, `${context}.scale[1]`)
        assertFiniteNumber(translateX, `${context}.translate[0]`)
        assertFiniteNumber(translateY, `${context}.translate[1]`)

        return {
          scale: [scaleX, scaleY],
          translate: [translateX, translateY],
        }
      }
      throw toProcessingError(`${context}.translate: должен быть массивом из 2 чисел`)
    }
    throw toProcessingError(`${context}.scale: должен быть массивом из 2 чисел`)
  }
  throw toProcessingError(`${context}: transform должен быть объектом`)
}

export const isValidTopoJsonBboxLength = (length: number): boolean => {
  return length === 4 || length === 6
}

/** Проверяет bbox: длина 2*n (§3). */
export const validateTopoJsonBbox = (bbox: unknown, context: string): void => {
  if (!Array.isArray(bbox)) {
    throw toProcessingError(`${context}: bbox должен быть массивом чисел`)
  }

  if (!isValidTopoJsonBboxLength(bbox.length)) {
    throw toProcessingError(`${context}: bbox должен содержать 4 или 6 чисел`)
  }

  for (let index = 0; index < bbox.length; index += 1) {
    const numericValue = Number(bbox[index])
    assertFiniteNumber(numericValue, `${context}[${index}]`)
  }
}
