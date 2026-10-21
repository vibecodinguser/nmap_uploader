import { defineContentScript } from 'wxt/utils/define-content-script'
import {
  findActiveMap,
  getCoordsFromUrlClick,
  PointPickerOverlay,
  subscribeToMapEvents,
  type YmapsMapLike,
  type YmapsMapWithContainer,
} from '@/lib/nmaps'
import { parseDrawMapObjectsDetail } from '@/lib/nmaps_draw_objects'
import { NMAPS_MAP_RESIZE_EVENT } from '@/lib/nmaps_map_resize_notify'
import {
  createNativeTracingAdapter,
  type NativeTracingAdapter,
  type NativeTracingMap,
} from '@/lib/nmaps_native_tracing_adapter'
import {
  NMAPS_CANCEL_PICK_POINT_EVENT,
  NMAPS_START_PICK_POINT_EVENT,
} from '@/lib/nmaps_pick_point_notify'
import { notifyNmapsUrlChange } from '@/lib/nmaps_url_notify'

let globalActiveMapInstance: YmapsMapLike | null = null

const dispatchWindowResize = (): void => {
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

const requestMapRepaint = (event?: Event): void => {
  dispatchWindowResize()

  const map = globalActiveMapInstance ?? findActiveMap()
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
        const activeMap = globalActiveMapInstance ?? findActiveMap()
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

const interceptYmaps = (): void => {
  if (typeof globalThis === 'undefined') return
  const ymaps = (globalThis as unknown as Record<string, any>).ymaps
  if (!ymaps || ymaps.__mapInterceptSetupDone) return
  ymaps.__mapInterceptSetupDone = true

  const _Map = ymaps.Map
  if (_Map && !_Map.__intercepted) {
    const OriginalMap = _Map
    ymaps.Map = function (this: unknown, ...args: unknown[]) {
      const instance = new OriginalMap(...args)
      globalActiveMapInstance = instance as YmapsMapLike
      return instance
    }
    ymaps.Map.__intercepted = true
    ymaps.Map.prototype = OriginalMap.prototype
  }
}

const startMapDiscovery = (): void => {
  const startedAt = Date.now()

  const poll = (): void => {
    if (Date.now() - startedAt <= 30_000) {
      const map = findActiveMap()
      if (map) {
        globalActiveMapInstance = map
        subscribeToMapEvents(map)
      } else {
        setTimeout(poll, 500)
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poll, { once: true })
  } else {
    poll()
  }
}

const wrapHistoryMethod = (method: 'pushState' | 'replaceState', onChange: () => void): void => {
  const original = history[method].bind(history)
  history[method] = ((...args: Parameters<typeof history.pushState>) => {
    original(...args)
    queueMicrotask(onChange)
  }) as typeof history.pushState
}

let customCollection: any = null

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    interceptYmaps()

    const windowWithTracingAdapter = globalThis as typeof globalThis & {
      __nmapNativeTracingAdapter__?: NativeTracingAdapter
    }
    windowWithTracingAdapter.__nmapNativeTracingAdapter__?.destroy()

    const tracingAdapter = createNativeTracingAdapter({
      globalObject: globalThis,
      getMap: () => (globalActiveMapInstance ?? findActiveMap()) as NativeTracingMap | null,
    })
    windowWithTracingAdapter.__nmapNativeTracingAdapter__ = tracingAdapter
    globalThis.addEventListener('pagehide', () => tracingAdapter.destroy(), { once: true })

    globalThis.addEventListener('hashchange', notifyNmapsUrlChange)
    globalThis.addEventListener('popstate', notifyNmapsUrlChange)

    wrapHistoryMethod('pushState', notifyNmapsUrlChange)
    wrapHistoryMethod('replaceState', notifyNmapsUrlChange)

    startMapDiscovery()

    document.addEventListener(NMAPS_MAP_RESIZE_EVENT, requestMapRepaint)

    document.addEventListener('nmaps:drawObjects', (event: Event) => {
      const detail = parseDrawMapObjectsDetail((event as CustomEvent).detail)
      if (!detail) return

      tracingAdapter.setTargets(detail.snapTargets)
      const { points } = detail

      const ymaps = (globalThis as unknown as Record<string, any>).ymaps
      if (!ymaps) return

      const map = globalActiveMapInstance ?? findActiveMap()
      if (!map) return

      if (!customCollection) {
        customCollection = new ymaps.GeoObjectCollection(
          {},
          {
            strokeColor: '#0078FF',
            strokeWidth: 3,
            fillColor: 'rgba(0, 120, 255, 0.25)',
          },
        )
        ;(map as Record<string, any>).geoObjects.add(customCollection)
      }

      customCollection.removeAll()

      points.forEach((p: any) => {
        if (p.geomType === 'Polygon' && p.geomCoords) {
          const polygon = new ymaps.Polygon(
            [p.geomCoords],
            { hintContent: p.name || p.noteDesc },
            { fill: !p.id },
          )
          customCollection.add(polygon)
        } else if (p.geomType === 'LineString' && p.geomCoords) {
          const polyline = new ymaps.Polyline(p.geomCoords, {
            hintContent: p.name || p.noteDesc,
          })
          customCollection.add(polyline)
        } else {
          const placemark = new ymaps.Placemark([p.longitude, p.latitude], {
            hintContent: p.name || p.noteDesc,
          })
          customCollection.add(placemark)
        }
      })
    })

    document.addEventListener('nmaps:centerMap', (event: Event) => {
      const customEvent = event as CustomEvent
      let detail = customEvent.detail
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail)
        } catch {
          // ignore
        }
      }
      const { latitude, longitude, zoom, duration } = detail ?? {}
      const lat = Number(latitude)
      const lon = Number(longitude)
      const z = Number(zoom) || 18
      const dur = typeof duration === 'number' ? duration : 0

      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        const map = globalActiveMapInstance ?? findActiveMap()
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
        globalThis.location.hash = `#!/?z=${z}&ll=${lon},${lat}`
      }
    })

    let activeCleanup: (() => void) | null = null

    document.addEventListener(NMAPS_CANCEL_PICK_POINT_EVENT, () => {
      activeCleanup?.()
    })

    document.addEventListener(NMAPS_START_PICK_POINT_EVENT, (event: Event) => {
      if (activeCleanup) return

      const geomType = (event as CustomEvent).detail?.geomType ?? 'Point'
      const picker = new PointPickerOverlay(
        geomType,
        () => {
          activeCleanup = null
        },
        (e) => {
          const map = globalActiveMapInstance ?? findActiveMap()
          if (!map) return null
          const m = map as Record<string, any>
          if (m.converter && m.options) {
            const projection = m.options.get('projection')
            const globalPixels = m.converter.pageToGlobal([e.clientX, e.clientY])
            return projection.fromGlobalPixels(globalPixels, m.getZoom())
          }
          return m.getCenter()
        },
      )

      activeCleanup = picker.start()
    })
  },
})
