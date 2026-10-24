import type { MapLocation } from '@/lib/go_to_link'
import {
  buildNakarteHash,
  mapNmapsLayerToNakarte,
  NMAP_UPLOADER_MSG_SOURCE,
  normalizeMapLocation,
  type SplitLocationMessage,
} from '@/lib/go_to_map_sync'

export const readLayersFromNakarteHash = (hash: string): string => {
  const layersMatch = hash.match(/(?:^|&)l=([^&]+)/u)
  return layersMatch?.[1] ?? 'S/K'
}

/** Применяет вид карты через replaceState без перезагрузки iframe (MAIN world nakarte). */
export const applyNakarteLocationToPage = (location: MapLocation): void => {
  const normalized = normalizeMapLocation(location)
  const currentHash = window.location.hash
  const defaultLayers = normalized.layer
    ? mapNmapsLayerToNakarte(normalized.layer)
    : readLayersFromNakarteHash(currentHash)
  const nextHash = buildNakarteHash(normalized, defaultLayers, currentHash)
  const nextHref = `${window.location.origin}${window.location.pathname}${window.location.search}#${nextHash}`
  if (window.location.href === nextHref) return

  history.replaceState(history.state, '', `#${nextHash}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export const parseSetLocationMessage = (data: unknown): MapLocation | null => {
  if (!data || typeof data !== 'object') return null

  const message = data as SplitLocationMessage
  if (message.source !== NMAP_UPLOADER_MSG_SOURCE) return null
  if (message.type !== 'set_location' || !message.location) return null

  return normalizeMapLocation(message.location)
}
