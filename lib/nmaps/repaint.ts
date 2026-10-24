import { findActiveMap, type YmapsMapLike, type YmapsMapWithContainer } from './map_discovery'

export const dispatchWindowResize = (): void => {
  if (typeof globalThis === 'undefined') return
  try {
    globalThis.dispatchEvent(new Event('resize'))
  } catch (e: unknown) {
    console.debug(e)
  }
}

type CenterableMap = {
  setCenter?: (center: [number, number], zoom?: number, options?: { duration?: number }) => unknown
  panTo?: (center: [number, number], zoom?: number, options?: { duration?: number }) => unknown
  moveTo?: (center: [number, number], zoom?: number, options?: { duration?: number }) => unknown
}

const applyMapCenter = (
  map: unknown,
  center: [number, number],
  zoom?: number,
  duration = 0,
): boolean => {
  const m = map as CenterableMap | null | undefined
  if (!m) return false
  const fn = m.setCenter ?? m.panTo ?? m.moveTo
  if (typeof fn === 'function') {
    fn.call(m, center, zoom, { duration })
    return true
  }
  return false
}

export const requestMapRepaint = (
  event?: Event,
  activeMapGetter: () => YmapsMapLike | null = findActiveMap,
): void => {
  dispatchWindowResize()

  const map = activeMapGetter()
  if (!map) return

  try {
    const detailRaw = (event as CustomEvent)?.detail
    let detail: Record<string, unknown> | undefined = detailRaw
    if (typeof detailRaw === 'string') {
      try {
        detail = JSON.parse(detailRaw)
      } catch (e: unknown) {
        console.debug(e)
      }
    }

    const targetLat =
      detail && typeof detail.latitude === 'number' && !Number.isNaN(detail.latitude)
        ? (detail.latitude as number)
        : undefined
    const targetLon =
      detail && typeof detail.longitude === 'number' && !Number.isNaN(detail.longitude)
        ? (detail.longitude as number)
        : undefined
    const targetCenter: [number, number] | undefined =
      targetLat !== undefined && targetLon !== undefined ? [targetLon, targetLat] : undefined
    const targetZoom =
      detail?.zoom !== undefined && !Number.isNaN(Number(detail.zoom))
        ? Number(detail.zoom)
        : undefined

    const fitAndCenter = () => {
      try {
        const activeMap = activeMapGetter()
        if (!activeMap) return

        const container = (activeMap as unknown as YmapsMapWithContainer)?.container
        container?.fitToViewport?.()

        const centerToApply = targetCenter ?? activeMap.getCenter?.()
        const zoomToApply = targetZoom ?? activeMap.getZoom?.()

        if (centerToApply && zoomToApply !== undefined) {
          applyMapCenter(activeMap, centerToApply, zoomToApply, 0)
        }
      } catch (e: unknown) {
        console.debug(e)
      }
    }

    fitAndCenter()
    requestAnimationFrame(fitAndCenter)
  } catch (err: unknown) {
    console.debug(err)
  }
}

export const centerMapOnLocation = (
  detail: { latitude?: unknown; longitude?: unknown; zoom?: unknown; duration?: unknown } | null,
  activeMapGetter: () => YmapsMapLike | null = findActiveMap,
): void => {
  const { latitude, longitude, zoom, duration } = detail ?? {}
  const lat = Number(latitude)
  const lon = Number(longitude)
  const z = Number(zoom) || 18
  const dur = typeof duration === 'number' ? duration : 0

  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    const map = activeMapGetter()
    if (map && applyMapCenter(map, [lon, lat], z, dur)) {
      return
    }
    if (typeof globalThis !== 'undefined' && globalThis.location) {
      globalThis.location.hash = `#!/?z=${z}&ll=${lon},${lat}`
    }
  }
}
