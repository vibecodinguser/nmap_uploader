/**
 * Извлечение кадастровых данных и формирование GeoJSON из объектов НСПД.
 */
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { normalizeFeatureCollectionToWgs84 } from '@/lib/nspd/coordinates'

export const CADASTRAL_NUMBER_REGEX = /\b\d{1,2}\s*:\s*\d{1,2}\s*:\s*\d{6,7}\s*:\s*\d+\b/

export interface NspdRawObject {
  geometry?: Geometry | null
  properties?: Record<string, unknown>
  cadastralNumber?: string
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

/** Санитизирует кадастровый номер для безопасного имени файла. */
export const sanitizeCadastralFileName = (cadNum: string): string => {
  return cadNum.replace(/[:\\/*?"<>|]/g, '_').trim()
}

/** Собирает GeoJSON FeatureCollection из набора объектов НСПД. */
export const buildGeoJsonFromNspdObjects = (
  objects: NspdRawObject[],
  fallbackName?: string,
): { featureCollection: FeatureCollection; primaryName: string } => {
  const features: Feature[] = []
  const cadNumbers: string[] = []

  for (const obj of objects) {
    if (!obj.geometry) continue

    const cadNum = obj.cadastralNumber ?? extractCadastralNumber(obj.properties) ?? undefined
    if (cadNum && !cadNumbers.includes(cadNum)) {
      cadNumbers.push(cadNum)
    }

    const featureName = cadNum ?? fallbackName ?? 'НСПД Объект'
    const address = typeof obj.address === 'string' ? obj.address : undefined
    const area = obj.area !== undefined ? String(obj.area) : undefined

    const properties: Record<string, unknown> = {
      ...(obj.properties ?? {}),
      name: featureName,
      cadastralNumber: cadNum,
      ...(address ? { address } : {}),
      ...(area ? { area } : {}),
    }

    features.push({
      type: 'Feature',
      geometry: obj.geometry,
      properties,
    })
  }

  const primaryName = cadNumbers.length > 0 ? cadNumbers.join('_') : (fallbackName ?? 'nspd_object')

  const rawCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features,
  }

  const featureCollection = normalizeFeatureCollectionToWgs84(rawCollection)

  return { featureCollection, primaryName }
}
