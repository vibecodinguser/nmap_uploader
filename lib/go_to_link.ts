import type { GoToSource } from '@/lib/go_to_sources'

export type MapLocation = {
  longitude: number
  latitude: number
  zoom: number
}

const MERCATOR_RADIUS = 6_378_137

const padTwoDigits = (value: number): string => String(value).padStart(2, '0')

const clampLatitude = (latitude: number): number => Math.max(-89.5, Math.min(89.5, latitude))

const applyZoomTransform = (
  zoom: number,
  countZoom: readonly [number, number] | undefined,
  maxZoom: number | undefined,
): number => {
  let nextZoom = zoom
  if (maxZoom !== undefined) nextZoom = Math.min(nextZoom, maxZoom)
  if (countZoom) nextZoom = countZoom[0] * nextZoom + countZoom[1]
  return nextZoom
}

const convertToMercator = (longitude: number, latitude: number): { lon: number; lat: number } => {
  const lon = MERCATOR_RADIUS * longitude * (Math.PI / 180)
  const lat = MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (latitude * (Math.PI / 180)) / 2))
  return { lon, lat }
}

/** Извлекает координаты и зум из URL редактора НЯК. */
export const getMapLocationFromUrl = (href: string): MapLocation | null => {
  try {
    const url = new URL(href.replace('/#!', ''))
    const ll = url.searchParams.get('ll')
    const zoomParam = url.searchParams.get('z')
    if (!ll || !zoomParam) return null

    const [lonRaw, latRaw] = ll.split(',')
    const longitude = Number(lonRaw)
    const latitude = Number(latRaw)
    const zoom = Number(zoomParam)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(zoom)) {
      return null
    }

    return {
      longitude,
      latitude: clampLatitude(latitude),
      zoom,
    }
  } catch {
    return null
  }
}

export const resolveMapLocationForSource = (
  location: MapLocation,
  source: GoToSource,
): MapLocation => {
  const zoom = applyZoomTransform(location.zoom, source.countZoom, source.maxZoom)
  if (!source.convert) {
    return { ...location, zoom }
  }

  const converted = convertToMercator(location.longitude, location.latitude)
  return {
    longitude: converted.lon,
    latitude: converted.lat,
    zoom,
  }
}

export const buildGoToLink = (
  source: GoToSource,
  location: MapLocation,
  now: Date = new Date(),
): string | null => {
  const resolved = resolveMapLocationForSource(location, source)
  const prevMonth = new Date(now)
  prevMonth.setMonth(prevMonth.getMonth() - 1)

  return source.linkTemplate
    .replaceAll('{zoom}', String(resolved.zoom))
    .replaceAll('{lat}', String(resolved.latitude))
    .replaceAll('{lon}', String(resolved.longitude))
    .replaceAll('{year}', String(now.getFullYear()))
    .replaceAll('{month}', padTwoDigits(now.getMonth() + 1))
    .replaceAll('{day}', padTwoDigits(now.getDate()))
    .replaceAll('{prevYear}', String(prevMonth.getFullYear()))
    .replaceAll('{prevMonth}', padTwoDigits(prevMonth.getMonth() + 1))
}
