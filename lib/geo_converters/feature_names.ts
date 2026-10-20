import type { Feature } from 'geojson'

const FEATURE_NAME_KEYS = ['name', 'title', 'NAME', 'TITLE', 'Name'] as const

const getTrimmedNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }
  return undefined
}

/**
 * Извлекает каноническое имя объекта из свойств GeoJSON Feature (чистая функция).
 */
export const extractFeatureName = (feature: Feature): string | undefined => {
  const props = feature.properties
  if (!props) return undefined

  for (const key of FEATURE_NAME_KEYS) {
    const name = getTrimmedNonEmptyString(props[key])
    if (name !== undefined) {
      return name
    }
  }

  return undefined
}
