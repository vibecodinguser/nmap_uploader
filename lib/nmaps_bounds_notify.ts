import type { MapLocation } from '@/lib/go_to_link'

/** Событие реалтайм-изменения вида карты НЯК (MAIN world → isolated). */
export const NMAPS_BOUNDS_CHANGE_EVENT = 'nmap-uploader-nmaps-bounds-change' as const

/** Отправляет CustomEvent с текущими координатами карты НЯК. */
export const notifyNmapsBoundsChange = (location: MapLocation): void => {
  document.dispatchEvent(
    new CustomEvent(NMAPS_BOUNDS_CHANGE_EVENT, {
      bubbles: true,
      detail: { longitude: location.longitude, latitude: location.latitude, zoom: location.zoom },
    }),
  )
}

/** Извлекает MapLocation из CustomEvent, отправленного notifyNmapsBoundsChange. */
export const parseBoundsChangeEvent = (event: Event): MapLocation | null => {
  if (!(event instanceof CustomEvent)) return null

  const detail = event.detail as
    | { longitude?: number; latitude?: number; zoom?: number }
    | undefined
  if (!detail) return null

  const { longitude, latitude, zoom } = detail
  if (
    typeof longitude !== 'number' ||
    typeof latitude !== 'number' ||
    typeof zoom !== 'number' ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(zoom)
  ) {
    return null
  }

  return { longitude, latitude, zoom }
}
