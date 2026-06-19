import type { MapLocation } from '@/lib/go_to_link'
import { buildGoToLink } from '@/lib/go_to_link'
import { GO_TO_SOURCES } from '@/lib/go_to_sources'

export const NMAP_UPLOADER_MSG_SOURCE = 'nmap_uploader' as const
export const NAKARTE_SYNC_MSG_SOURCE = 'nakarte_sync' as const

export type SplitLocationMessage = {
  source: typeof NMAP_UPLOADER_MSG_SOURCE | typeof NAKARTE_SYNC_MSG_SOURCE
  type: 'set_location' | 'location' | 'cursor'
  location: MapLocation | null
}

const NAKARTE_HASH_RE = /[#&]m=(\d+(?:\.\d+)?)\/([-\d.]+)\/([-\d.]+)/u
const NAKARTE_DEFAULT_URL = 'https://nakarte.me/'

/** Извлекает координаты и зум из hash URL nakarte (#m=z/lat/lon). */
export const getMapLocationFromNakarteUrl = (href: string): MapLocation | null => {
  try {
    const match = new URL(href).hash.match(NAKARTE_HASH_RE)
    if (!match) return null

    const zoom = Number(match[1])
    const latitude = Number(match[2])
    const longitude = Number(match[3])
    if (!Number.isFinite(zoom) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null
    }

    return { longitude, latitude, zoom }
  } catch {
    return null
  }
}

/** Собирает URL nakarte для текущего вида карты. */
export const buildNakarteUrl = (location: MapLocation): string => {
  const link = buildGoToLink(GO_TO_SOURCES.Nakarte, location)
  if (!link) return NAKARTE_DEFAULT_URL
  return link.replace(/^http:\/\//u, 'https://')
}

/** Обновляет ll/z в hash-URL редактора НЯК, сохраняя остальные параметры. */
export const buildNmapsUrlFromLocation = (location: MapLocation, currentHref: string): string => {
  const hashPrefix = '#!'
  const hashIndex = currentHref.indexOf(hashPrefix)
  if (hashIndex === -1) return currentHref

  const beforeHash = currentHref.slice(0, hashIndex + hashPrefix.length)
  const afterHash = currentHref.slice(hashIndex + hashPrefix.length)
  const queryIndex = afterHash.indexOf('?')
  const pathPart = queryIndex >= 0 ? afterHash.slice(0, queryIndex) : afterHash
  const existingQuery = queryIndex >= 0 ? afterHash.slice(queryIndex + 1) : ''
  const params = new URLSearchParams(existingQuery)
  params.set('ll', `${location.longitude},${location.latitude}`)
  params.set('z', String(location.zoom))
  return `${beforeHash}${pathPart}?${params.toString()}`
}

export const locationsEqual = (a: MapLocation | null, b: MapLocation | null): boolean => {
  if (!a || !b) return false
  const epsilon = 1e-6
  return (
    Math.abs(a.longitude - b.longitude) < epsilon &&
    Math.abs(a.latitude - b.latitude) < epsilon &&
    Math.abs(a.zoom - b.zoom) < epsilon
  )
}

/** Нормализует зум для nakarte (целое значение 0–32). */
export const normalizeMapZoom = (zoom: number): number => {
  const rounded = Math.round(zoom)
  return Math.max(0, Math.min(32, rounded))
}

/** Приводит координаты к формату, ожидаемому nakarte. */
export const normalizeMapLocation = (location: MapLocation): MapLocation => ({
  longitude: location.longitude,
  latitude: location.latitude,
  zoom: normalizeMapZoom(location.zoom),
})

const NAKARTE_COORD_PRECISION = 5

/** Собирает hash nakarte (#m=z/lat/lon&l=...) в формате редактора. */
export const buildNakarteHash = (location: MapLocation, layers = 'S/K'): string => {
  const normalized = normalizeMapLocation(location)
  const lat = normalized.latitude.toFixed(NAKARTE_COORD_PRECISION)
  const lng = normalized.longitude.toFixed(NAKARTE_COORD_PRECISION)
  return `m=${normalized.zoom}/${lat}/${lng}&l=${layers}`
}
