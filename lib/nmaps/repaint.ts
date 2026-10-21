import { findActiveMap, type YmapsMapLike, type YmapsMapWithContainer } from './map_discovery'

export const dispatchWindowResize = (): void => {
  if (typeof globalThis === 'undefined') return
  const w = globalThis.innerWidth
  const h = globalThis.innerHeight

  Object.defineProperty(globalThis, 'innerWidth', { value: w + 1, configurable: true })
  Object.defineProperty(globalThis, 'innerHeight', { value: h + 1, configurable: true })

  const intervals = [0, 100, 200, 300, 500, 800]
  intervals.forEach((delay) => {
    if (delay === 0) {
      globalThis.dispatchEvent(new Event('resize'))
    } else {
      setTimeout(() => globalThis.dispatchEvent(new Event('resize')), delay)
    }
  })

  setTimeout(() => {
    delete (globalThis as unknown as Record<string, unknown>).innerWidth
    delete (globalThis as unknown as Record<string, unknown>).innerHeight
    globalThis.dispatchEvent(new Event('resize'))
  }, 1000)
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

    let center: [number, number] | undefined
    let zoom: number | undefined

    if (detail && typeof detail.latitude === 'number' && typeof detail.longitude === 'number') {
      const targetCenter = [detail.longitude, detail.latitude]
      const targetZoom = Number(detail.zoom)

      setTimeout(() => {
        const activeMap = activeMapGetter()
        if (activeMap && typeof (activeMap as Record<string, unknown>).setCenter === 'function') {
          try {
            ;(activeMap as Record<string, any>).setCenter(targetCenter, targetZoom, { duration: 0 })
          } catch (e: unknown) {
            console.debug(e)
          }
        }
      }, 200)
    } else {
      try {
        center = map.getCenter()
        zoom = map.getZoom()
      } catch (e: unknown) {
        console.debug(e)
      }
    }

    const container = (map as unknown as YmapsMapWithContainer).container
    container?.fitToViewport?.()

    if (center && zoom !== undefined) {
      const centerMethod = ['setCenter', 'panTo', 'moveTo'].find(
        (m) => typeof (map as Record<string, unknown>)[m] === 'function',
      )
      if (centerMethod) {
        ;(map as Record<string, any>)[centerMethod](center, zoom, { duration: 0 })
      }
    }
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
    if (map) {
      try {
        const centerMethod = ['setCenter', 'panTo', 'moveTo'].find(
          (m) => typeof (map as Record<string, any>)[m] === 'function',
        )
        if (centerMethod) {
          ;(map as Record<string, any>)[centerMethod]([lon, lat], z, { duration: dur })
          return
        }
      } catch {
        // fallback
      }
    }
    if (typeof globalThis !== 'undefined' && globalThis.location) {
      globalThis.location.hash = `#!/?z=${z}&ll=${lon},${lat}`
    }
  }
}
