import { toProcessingError, validateTopoJsonPosition } from './topojson_coords'

/** Проверяет arc: массив из 2+ позиций (§2.1.3). */
export const validateTopoJsonArc = (arc: unknown, context: string, isQuantized: boolean): void => {
  if (!Array.isArray(arc)) {
    throw toProcessingError(`${context}: arc должен быть массивом позиций`)
  }

  if (arc.length < 2) {
    throw toProcessingError(`${context}: arc должен содержать минимум 2 позиции`)
  }

  for (let index = 0; index < arc.length; index += 1) {
    validateTopoJsonPosition(arc[index], `${context}[${index}]`, isQuantized)
  }
}

/** Разрешает arc index, включая отрицательные (§2.1.4). */
export const resolveTopoJsonArcIndex = (index: number): number => {
  if (index < 0) {
    return ~index
  }
  return index
}

const validateArcIndexValue = (value: unknown, arcCount: number, context: string): void => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw toProcessingError(`${context}: arc index должен быть целым числом`)
  }

  const resolved = resolveTopoJsonArcIndex(value)
  if (resolved < 0 || resolved >= arcCount) {
    throw toProcessingError(
      `${context}: arc index ${value} вне диапазона [${-arcCount}, ${arcCount - 1}]`,
    )
  }
}

const validateArcIndexAtDepth = (
  item: unknown,
  arcCount: number,
  context: string,
  depth: 1 | 2 | 3,
): void => {
  if (depth === 1) {
    validateArcIndexValue(item, arcCount, context)
  } else {
    validateArcIndexArray(item, arcCount, context, (depth - 1) as 1 | 2)
  }
}

export const validateArcIndexArray = (
  value: unknown,
  arcCount: number,
  context: string,
  depth: 1 | 2 | 3,
): void => {
  if (!Array.isArray(value)) {
    throw toProcessingError(`${context}: arcs должен быть массивом`)
  }

  for (let index = 0; index < value.length; index += 1) {
    validateArcIndexAtDepth(value[index], arcCount, `${context}[${index}]`, depth)
  }
}
