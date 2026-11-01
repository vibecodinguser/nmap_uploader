/**
 * Извлечение кадастровых данных и формирование GeoJSON из объектов НСПД.
 */
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { normalizeFeatureCollectionToWgs84 } from '@/lib/nspd/coordinates'

export const CADASTRAL_NUMBER_REGEX = /\b\d{1,2}\s*:\s*\d{1,2}\s*:\s*\d{6,7}\s*:\s*\d+\b/
export const REGISTRY_NUMBER_REGEX = /\b\d{1,2}\s*:\s*\d{1,2}\s*-\s*[\d.]+\b/

export const REGISTRY_PROPERTY_KEYS = [
  'reg_num',
  'reg_number',
  'registry_number',
  'regNumber',
  'registryNumber',
  'account_number',
  'accountNumber',
  'reestr_number',
  'reestr_num',
  'registry_no',
  'reg_no',
  'registration_number',
] as const

export interface NspdRawObject {
  geometry?: Geometry | null
  properties?: Record<string, unknown>
  cadastralNumber?: string
  registryNumber?: string
  address?: string
  area?: number | string
}

/** Извлекает кадастровый номер из строки или объекта свойств. */
export const extractCadastralNumber = (input: unknown): string | null => {
  if (typeof input === 'string') {
    const match = input.match(CADASTRAL_NUMBER_REGEX)
    return match ? match[0].replace(/\s+/g, '') : null
  }

  if (input && typeof input === 'object') {
    const props = input as Record<string, unknown>
    const candidates = [
      props.cad_num,
      props.cadastral_number,
      props.cadNumber,
      props.cadastralNumber,
      props.cn,
      props.name,
      props.label,
      props.id,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const found = extractCadastralNumber(candidate)
        if (found) return found
      }
    }
  }

  return null
}

/** Извлекает реестровый номер из строки или объекта свойств. */
export const extractRegistryNumber = (input: unknown): string | null => {
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null

    const match = trimmed.match(REGISTRY_NUMBER_REGEX)
    if (match) {
      return match[0].replace(/\s+/g, '')
    }

    const labeledMatch = trimmed.match(
      /реестровый\s+номер(?:\s+границ)?\s*[:№]\s*([^\s\n\r,:№][^\n\r,]*)/i,
    )
    if (labeledMatch?.[1]) {
      const candidate = labeledMatch[1].trim()
      if (candidate.length > 0 && candidate !== ':') return candidate
    }

    return null
  }

  if (input && typeof input === 'object') {
    const props = input as Record<string, unknown>

    for (const key of REGISTRY_PROPERTY_KEYS) {
      const val = props[key]
      if (typeof val === 'string') {
        const trimmed = val.trim()
        if (trimmed.length > 0) return trimmed
      } else if (typeof val === 'number') {
        return String(val)
      }
    }

    for (const fallbackKey of ['name', 'label', 'description', 'title']) {
      const val = props[fallbackKey]
      if (typeof val === 'string') {
        const found = extractRegistryNumber(val)
        if (found) return found
      }
    }
  }

  return null
}

/** Санитизирует кадастровый или реестровый номер для безопасного имени файла. */
export const sanitizeCadastralFileName = (cadNum: string): string => {
  return cadNum.replace(/[:\\/*?"<>|]/g, '_').trim()
}

/** Собирает GeoJSON FeatureCollection из набора объектов НСПД. */
export const buildGeoJsonFromNspdObjects = (
  objects: NspdRawObject[],
  fallbackName?: string,
): { featureCollection: FeatureCollection; primaryName: string } => {
  const features: Feature[] = []
  const identifiers: string[] = []

  for (const obj of objects) {
    if (!obj.geometry) continue

    const cadNum = obj.cadastralNumber ?? extractCadastralNumber(obj.properties) ?? undefined
    const regNum = obj.registryNumber ?? extractRegistryNumber(obj.properties) ?? undefined
    const identifier = cadNum ?? regNum

    if (identifier && !identifiers.includes(identifier)) {
      identifiers.push(identifier)
    }

    const featureName = identifier ?? fallbackName ?? 'НСПД Объект'
    const address = typeof obj.address === 'string' ? obj.address : undefined
    const area = obj.area !== undefined ? String(obj.area) : undefined

    const properties: Record<string, unknown> = {
      ...(obj.properties ?? {}),
      name: featureName,
      ...(cadNum ? { cadastralNumber: cadNum } : {}),
      ...(regNum ? { registryNumber: regNum } : {}),
      ...(address ? { address } : {}),
      ...(area ? { area } : {}),
    }

    features.push({
      type: 'Feature',
      geometry: obj.geometry,
      properties,
    })
  }

  const primaryName =
    identifiers.length > 0 ? identifiers.join('_') : (fallbackName ?? 'nspd_object')

  const rawCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features,
  }

  const featureCollection = normalizeFeatureCollectionToWgs84(rawCollection)

  return { featureCollection, primaryName }
}
