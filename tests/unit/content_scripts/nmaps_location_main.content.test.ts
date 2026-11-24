// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import nmapsLocationMainScript from '@/entrypoints/nmaps-location-main.content'
import { NMAPS_BOUNDS_CHANGE_EVENT, parseBoundsChangeEvent } from '@/lib/nmaps_bounds_notify'
import { NMAPS_MAP_RESIZE_EVENT } from '@/lib/nmaps_map_resize_notify'
import { NMAPS_URL_CHANGE_EVENT } from '@/lib/nmaps_url_notify'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const runMain = (): void => {
  nmapsLocationMainScript.main?.(createContentScriptContext())
}

type Coordinate = [number, number]

class FakePolygon {
  constructor(private coordinates: Coordinate[][]) {}
  getCoordinates(): Coordinate[][] {
    return this.coordinates
  }
  getType(): string {
    return 'Polygon'
  }
  isTypeOf(type: string): boolean {
    return type === 'Polygon'
  }
}

class FakeGeometryFactory {
  createPoint(): object {
    return {}
  }
  createPolyline(): object {
    return {}
  }
  createCollection(): object {
    return {}
  }
  createPolygon(coordinates: Coordinate[][]): FakePolygon {
    return new FakePolygon(coordinates)
  }
}

class FakeHotspot {
  attrs = {
    disabled: true,
    hotspotWidth: 10,
    ignoreZMax: true,
    simplify: false,
    zIndex: -1,
  }
  onRender(): void {}
  onInit(): void {}
  onUnmount(): void {}
  getGeoObjectsByCoords(_coordinates: Coordinate): Promise<unknown[]> {
    return Promise.resolve([])
  }
}

type WebpackFactory = (
  module: { exports: Record<string, unknown> },
  exports: Record<string, unknown>,
  require: unknown,
) => void

const installFakeNmapsModules = (): void => {
  const globalObject = globalThis as typeof globalThis & {
    webpackChunknmaps?: [number[], Record<string, WebpackFactory>][]
  }
  if (!globalObject.webpackChunknmaps) {
    globalObject.webpackChunknmaps = []
  }
  const chunks = globalObject.webpackChunknmaps
  const factories: Record<string, WebpackFactory> = {}
  chunks.push = (chunk) => {
    Object.assign(factories, chunk[1])
    return 1
  }
  chunks.push([
    [265],
    {
      48590: (_module, exports) => {
        exports.A = FakeGeometryFactory
      },
      61653: (_module, exports) => {
        exports.A = FakeHotspot
      },
    },
  ])
  for (const moduleId of ['48590', '61653']) {
    const module = { exports: {} as Record<string, unknown> }
    factories[moduleId](module, module.exports, vi.fn())
  }
}

const polygonNote = (id: string) => ({
  id,
  kind: 'Polygon' as const,
  name: id,
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: { color: '#1a8cff', fillColor: '#1a8cff', hatch: null, opacity: 1, strokeWidth: 3 },
  groupId: null,
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
})

const renderNotesEvent = (
  notes: unknown[],
  geometries: Record<string, unknown>,
  hiddenIds: string[] = [],
): CustomEvent =>
  new CustomEvent('yamapper-render-notes', {
    detail: JSON.stringify({ notes, geometries, groups: [], hiddenIds, iconUrls: {} }),
  })

describe('nmaps-location-main.content', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.location.hash = '#!/objects/1?z=10&ll=37.6%2C55.7'
  })

  afterEach(() => {
    vi.useRealTimers()
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    document.body.replaceChildren()
    Reflect.deleteProperty(globalThis, 'webpackChunknmaps')
  })

  it('транслирует hashchange в CustomEvent смены URL', () => {
    const handler = vi.fn()
    document.addEventListener(NMAPS_URL_CHANGE_EVENT, handler)

    runMain()
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('транслирует pushState в CustomEvent смены URL', async () => {
    const handler = vi.fn()
    document.addEventListener(NMAPS_URL_CHANGE_EVENT, handler)

    runMain()
    handler.mockClear()

    history.pushState(null, '', '#!/objects/2?z=12&ll=38%2C56')
    await Promise.resolve()

    expect(handler).toHaveBeenCalled()
  })

  it('отправляет boundschange при событиях ymaps-карты', () => {
    const handler = vi.fn()
    document.addEventListener(NMAPS_BOUNDS_CHANGE_EVENT, handler)

    const boundsHandlers: Record<string, (...args: unknown[]) => void> = {}
    const mapElement = document.createElement('div')
    mapElement.className = 'ymaps-map'
    const mapInstance = {
      getCenter: () => [37.6, 55.7] as [number, number],
      getZoom: () => 12,
      events: {
        add: (event: string, handlerFn: (...args: unknown[]) => void) => {
          boundsHandlers[event] = handlerFn
        },
        remove: vi.fn(),
      },
    }
    ;(mapElement as unknown as Record<string, unknown>).__ymaps_map = mapInstance
    document.body.appendChild(mapElement)

    runMain()
    vi.runAllTimers()

    boundsHandlers.boundschange?.()

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0]?.[0] as Event
    expect(parseBoundsChangeEvent(event)).toEqual({
      longitude: 37.6,
      latitude: 55.7,
      zoom: 12,
    })
  })

  it('перерисовывает карту по событию resize панели', () => {
    const resizeSpy = vi.spyOn(window, 'dispatchEvent')
    const mapInstance = {
      getCenter: () => [37.6, 55.7] as [number, number],
      getZoom: () => 12,
      events: { add: vi.fn(), remove: vi.fn() },
      container: { fitToViewport: vi.fn() },
    }
    const mapElement = document.createElement('div')
    mapElement.className = 'ymaps-map'
    ;(mapElement as unknown as Record<string, unknown>).__ymaps_map = mapInstance
    document.body.appendChild(mapElement)

    runMain()
    vi.runAllTimers()

    resizeSpy.mockClear()
    document.dispatchEvent(new CustomEvent(NMAPS_MAP_RESIZE_EVENT))

    expect(resizeSpy).toHaveBeenCalledWith(expect.any(Event))
    expect(mapInstance.container.fitToViewport).toHaveBeenCalled()
  })

  it('передаёт все snapTargets штатному tracer-provider без DOM-перехвата', async () => {
    const mapInstance = {
      getCenter: () => [37.6, 55.7] as [number, number],
      getZoom: () => 18,
      events: { add: vi.fn(), remove: vi.fn() },
      options: {
        get: () => ({
          toGlobalPixels: (coordinates: Coordinate) => coordinates,
        }),
      },
    }
    const mapElement = document.createElement('div')
    mapElement.className = 'nk-map ymaps-map'
    ;(mapElement as unknown as Record<string, unknown>).__ymaps_map = mapInstance
    document.body.appendChild(mapElement)

    runMain()
    vi.runAllTimers()
    installFakeNmapsModules()

    const leftRing = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 0],
    ]
    const rightRing = [
      [200, 0],
      [300, 0],
      [300, 100],
      [200, 0],
    ]

    document.dispatchEvent(
      renderNotesEvent([polygonNote('left'), polygonNote('right')], {
        left: { kind: 'Polygon', coords: leftRing },
        right: { kind: 'Polygon', coords: rightRing },
      }),
    )
    const withTarget = await new FakeHotspot().getGeoObjectsByCoords([240, 6])

    document.dispatchEvent(renderNotesEvent([], {}))
    const withoutTarget = await new FakeHotspot().getGeoObjectsByCoords([40, 6])

    expect(withTarget.map((item) => (item as { getId: () => string }).getId())).toContain(
      'yamapper:note:right',
    )
    expect(withoutTarget).toEqual([])
    expect(document.querySelector('[data-nmap-snap-marker]')).toBeNull()
  })

  it('перехватывает карту через ymaps.modules и активирует трассировку без DOM-свойств', async () => {
    class FakeGeoCollection {
      add = vi.fn()
      removeAll = vi.fn()
    }

    class DynamicMap {
      events = { add: vi.fn(), remove: vi.fn() }
      geoObjects = { add: vi.fn() }
      options = {
        get: () => ({
          toGlobalPixels: (coords: Coordinate) => coords,
        }),
      }
      getCenter(): [number, number] {
        return [37.6, 55.7]
      }
      getZoom(): number {
        return 18
      }
    }

    const fakeYmaps = {
      GeoObjectCollection: FakeGeoCollection,
      modules: {
        require: (modules: string[], callback: (MapConstructor: unknown) => void) => {
          if (modules.includes('Map')) {
            callback(DynamicMap)
          }
        },
      },
    }
    ;(globalThis as unknown as Record<string, unknown>).ymaps = fakeYmaps

    runMain()
    vi.runAllTimers()
    installFakeNmapsModules()

    // Экземпляр создается модульной системой Яндекса без привязки к DOM
    const mapInstance = new DynamicMap()
    mapInstance.getZoom()

    document.dispatchEvent(
      renderNotesEvent([polygonNote('sample')], {
        sample: {
          kind: 'Polygon',
          coords: [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 0],
          ],
        },
      }),
    )

    const result = await new FakeHotspot().getGeoObjectsByCoords([50, 5])
    expect(result.map((item) => (item as { getId: () => string }).getId())).toContain(
      'yamapper:note:sample',
    )
  })
})
