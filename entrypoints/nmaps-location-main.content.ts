import { defineContentScript } from 'wxt/utils/define-content-script'
import {
  centerMapOnLocation,
  findActiveMap,
  hookYmapsModuleMap,
  NmapsObjectDrawer,
  PointPickerOverlay,
  requestMapRepaint,
  subscribeToMapEvents,
  type YmapsMapLike,
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

const handleMapInstanceFound = (instance: YmapsMapLike): void => {
  if (globalActiveMapInstance !== instance) {
    globalActiveMapInstance = instance
    subscribeToMapEvents(instance)
  }
}

const getActiveMap = (): YmapsMapLike | null => globalActiveMapInstance ?? findActiveMap()

type MapConstructorLike = {
  new (...args: unknown[]): unknown
  prototype: unknown
  __intercepted?: boolean
} & Record<string, unknown>

interface YmapsGlobalLike {
  Map?: MapConstructorLike
  ready?: (cb: () => void) => void
  modules?: {
    require?: (
      modules: string[],
      successCallback: (MapConstructor: unknown) => void,
      errorCallback?: () => void,
    ) => void
  }
  __mapGetterConfigured?: boolean
  __readyHooked?: boolean
}

const interceptYmaps = (): void => {
  if (typeof globalThis === 'undefined') return
  const g = globalThis as unknown as Record<string, unknown>
  const ymaps = g.ymaps as YmapsGlobalLike | undefined
  if (!ymaps) return

  const wrapConstructor = (OriginalMap: unknown): MapConstructorLike => {
    if (typeof OriginalMap !== 'function') return OriginalMap as MapConstructorLike
    const mapFn = OriginalMap as MapConstructorLike
    if (mapFn.__intercepted) return mapFn

    const InterceptedMap = function (this: unknown, ...args: unknown[]) {
      const instance = new mapFn(...args)
      handleMapInstanceFound(instance as YmapsMapLike)
      return instance
    } as unknown as MapConstructorLike

    InterceptedMap.__intercepted = true
    InterceptedMap.prototype = mapFn.prototype
    Object.assign(InterceptedMap, mapFn)
    return InterceptedMap
  }

  if (ymaps.Map) {
    ymaps.Map = wrapConstructor(ymaps.Map)
  } else if (!ymaps.__mapGetterConfigured) {
    ymaps.__mapGetterConfigured = true
    let internalMap: MapConstructorLike | undefined
    Object.defineProperty(ymaps, 'Map', {
      configurable: true,
      enumerable: true,
      get: () => internalMap,
      set: (val: unknown) => {
        internalMap = wrapConstructor(val)
      },
    })
  }

  if (typeof ymaps.ready === 'function' && !ymaps.__readyHooked) {
    ymaps.__readyHooked = true
    try {
      ymaps.ready(() => {
        hookYmapsModuleMap(ymaps, handleMapInstanceFound)
        if (ymaps.Map && !ymaps.Map.__intercepted) {
          ymaps.Map = wrapConstructor(ymaps.Map)
        }
      })
    } catch {}
  }
}

const startMapDiscovery = (): void => {
  const startedAt = Date.now()

  const poll = (): void => {
    if (Date.now() - startedAt <= 30_000) {
      interceptYmaps()
      const map = findActiveMap()
      if (map) {
        handleMapInstanceFound(map)
      } else {
        const g = globalThis as unknown as Record<string, unknown>
        if (g.ymaps) {
          hookYmapsModuleMap(g.ymaps, handleMapInstanceFound)
        }
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

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    const g = globalThis as unknown as Record<string, unknown>
    if (g.ymaps) {
      interceptYmaps()
    } else {
      let internalYmaps: unknown
      try {
        Object.defineProperty(g, 'ymaps', {
          configurable: true,
          enumerable: true,
          get: () => internalYmaps,
          set: (val: unknown) => {
            internalYmaps = val
            if (val) {
              interceptYmaps()
            }
          },
        })
      } catch {
        interceptYmaps()
      }
    }

    const windowWithTracingAdapter = globalThis as typeof globalThis & {
      __nmapNativeTracingAdapter__?: NativeTracingAdapter
    }
    windowWithTracingAdapter.__nmapNativeTracingAdapter__?.destroy()

    const tracingAdapter = createNativeTracingAdapter({
      globalObject: globalThis,
      getMap: () => getActiveMap() as NativeTracingMap | null,
    })
    windowWithTracingAdapter.__nmapNativeTracingAdapter__ = tracingAdapter
    globalThis.addEventListener('pagehide', () => tracingAdapter.destroy(), { once: true })

    globalThis.addEventListener('hashchange', notifyNmapsUrlChange)
    globalThis.addEventListener('popstate', notifyNmapsUrlChange)

    wrapHistoryMethod('pushState', notifyNmapsUrlChange)
    wrapHistoryMethod('replaceState', notifyNmapsUrlChange)

    startMapDiscovery()

    const drawer = new NmapsObjectDrawer()

    document.addEventListener(NMAPS_MAP_RESIZE_EVENT, (e) => requestMapRepaint(e, getActiveMap))

    const applyMapObjectsDetail = (rawDetail: unknown): void => {
      const detail = parseDrawMapObjectsDetail(rawDetail)
      if (!detail) return

      tracingAdapter.setTargets(detail.snapTargets)
      drawer.drawObjects(detail, getActiveMap)
    }

    document.addEventListener('nmaps:drawObjects', (event: Event) => {
      applyMapObjectsDetail((event as CustomEvent).detail)
    })

    globalThis.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.action === 'DRAW_MAP_OBJECTS' && event.data.detail) {
        applyMapObjectsDetail(event.data.detail)
      }
    })

    document.addEventListener('nmaps:centerMap', (event: Event) => {
      const customEvent = event as CustomEvent
      let detail = customEvent.detail
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail)
        } catch {}
      }
      centerMapOnLocation(detail, getActiveMap)
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
          const map = getActiveMap()
          if (!map) return null
          const m = map as Record<string, unknown> & {
            converter?: { pageToGlobal: (coords: [number, number]) => [number, number] }
            options?: {
              get: (name: string) => {
                fromGlobalPixels: (pixels: [number, number], zoom: number) => [number, number]
              }
            }
          }
          if (m.converter && m.options) {
            const projection = m.options.get('projection')
            const globalPixels = m.converter.pageToGlobal([e.clientX, e.clientY])
            return projection.fromGlobalPixels(globalPixels, map.getZoom())
          }
          return map.getCenter()
        },
      )

      activeCleanup = picker.start()
    })
  },
})
