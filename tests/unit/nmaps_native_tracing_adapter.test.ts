import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNativeTracingAdapter,
  type NativeTracingMap,
} from '@/lib/nmaps_native_tracing_adapter'

type Coordinate = [number, number]

class FakePolygon {
  constructor(private coordinates: Coordinate[][]) {}

  getCoordinates(): Coordinate[][] {
    return this.coordinates
  }

  setCoordinates(value: Coordinate[][]): this {
    this.coordinates = value
    return this
  }

  getType(): string {
    return 'Polygon'
  }

  isTypeOf(type: string): boolean {
    return type === 'Polygon'
  }

  isEqual(other: FakePolygon): boolean {
    return JSON.stringify(other.getCoordinates()) === JSON.stringify(this.coordinates)
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

const nativeCandidate = {
  getId: () => 'native',
  getGeometry: () => new FakePolygon([[]]),
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
    return Promise.resolve([nativeCandidate])
  }
}

type Factory = (
  module: { exports: Record<string, unknown> },
  exports: Record<string, unknown>,
  require: unknown,
) => void

type Chunk = [number[], Record<string, Factory>]

const target = {
  id: 'polygon',
  coordinates: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 0],
  ] as Coordinate[],
}

const createMap = (): NativeTracingMap => ({
  getZoom: () => 18,
  options: {
    get: () => ({
      toGlobalPixels: (coordinates: Coordinate) => coordinates,
    }),
  },
})

const installModules = (
  globalObject: Record<string, unknown>,
  GeometryFactory: typeof FakeGeometryFactory = FakeGeometryFactory,
  Hotspot: typeof FakeHotspot = FakeHotspot,
): void => {
  const chunks = globalObject.webpackChunknmaps as Chunk[] & {
    push: (chunk: Chunk) => number
  }
  const factories: Record<string, Factory> = {}
  chunks.push = (chunk: Chunk) => {
    Object.assign(factories, chunk[1])
    return 1
  }
  chunks.push([
    [265],
    {
      48590: (_module, exports) => {
        exports.A = GeometryFactory
      },
      61653: (_module, exports) => {
        exports.A = Hotspot
      },
    },
  ])
  for (const moduleId of ['48590', '61653']) {
    const module = { exports: {} as Record<string, unknown> }
    factories[moduleId](module, module.exports, vi.fn())
  }
}

describe('createNativeTracingAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('активируется только после обнаружения обоих нативных контрактов', () => {
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })

    expect(adapter.getCapability()).toBe('pending')
    installModules(globalObject)
    expect(adapter.getCapability()).toBe('active')

    adapter.destroy()
  })

  it('добавляет read-only цель возле ребра и не изменяет исходных кандидатов', async () => {
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })
    installModules(globalObject)
    adapter.setTargets([target])
    const hotspot = new FakeHotspot()
    const original = await Promise.resolve([nativeCandidate])

    await hotspot.getGeoObjectsByCoords([20, 6])
    await hotspot.getGeoObjectsByCoords([60, 6])
    const result = await hotspot.getGeoObjectsByCoords([40, 6])

    expect(original).toEqual([nativeCandidate])
    expect(result).toHaveLength(2)
    expect((result[1] as { getId: () => string }).getId()).toBe('nmap-uploader:note:polygon')
    expect(Object.isFrozen(result[1])).toBe(true)
    const geometry = (result[1] as { getGeometry: () => FakePolygon }).getGeometry()
    expect(geometry.getType()).toBe('Polygon')
    expect(geometry.getCoordinates()[0]).toEqual(target.coordinates)
    adapter.destroy()
  })

  it('не добавляет цель вне hotspot-порога', async () => {
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })
    installModules(globalObject)
    adapter.setTargets([target])

    const result = await new FakeHotspot().getGeoObjectsByCoords([40, 20])

    expect(result).toEqual([nativeCandidate])
    adapter.destroy()
  })

  it('не добавляет дубликат и сбрасывает заменённую цель', async () => {
    class HotspotWithDuplicate extends FakeHotspot {
      override getGeoObjectsByCoords(_coordinates: Coordinate): Promise<unknown[]> {
        return Promise.resolve([
          nativeCandidate,
          { getId: () => 'nmap-uploader:note:polygon', getGeometry: () => new FakePolygon([[]]) },
        ])
      }
    }
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })
    installModules(globalObject, FakeGeometryFactory, HotspotWithDuplicate)
    adapter.setTargets([target])

    const withTarget = await new HotspotWithDuplicate().getGeoObjectsByCoords([40, 6])
    adapter.setTargets([])
    const withoutTarget = await new HotspotWithDuplicate().getGeoObjectsByCoords([40, 6])

    expect(
      withTarget.filter(
        (item) => (item as { getId: () => string }).getId() === 'nmap-uploader:note:polygon',
      ),
    ).toHaveLength(1)
    expect(withoutTarget).toHaveLength(2)
    adapter.destroy()
  })

  it('не расширяет hotspot без признаков штатного tracer-provider', async () => {
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })
    installModules(globalObject)
    adapter.setTargets([target])
    const hotspot = new FakeHotspot()
    hotspot.attrs.disabled = false

    expect(await hotspot.getGeoObjectsByCoords([40, 6])).toEqual([nativeCandidate])
    adapter.destroy()
  })

  it('выбирает ближайший из нескольких полигонов', async () => {
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })
    installModules(globalObject)
    adapter.setTargets([
      target,
      {
        id: 'near-second',
        coordinates: [
          [200, 0],
          [300, 0],
          [300, 100],
          [200, 0],
        ],
      },
    ])

    const result = await new FakeHotspot().getGeoObjectsByCoords([240, 6])

    expect(result.map((item) => (item as { getId: () => string }).getId())).toEqual([
      'native',
      'nmap-uploader:note:near-second',
    ])
    adapter.destroy()
  })

  it('при равном расстоянии выбирает первую цель и добавляет один candidate', async () => {
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })
    installModules(globalObject)
    adapter.setTargets([
      {
        id: 'first',
        coordinates: [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 0],
        ],
      },
      {
        id: 'second',
        coordinates: [
          [0, 8],
          [100, 8],
          [100, 108],
          [0, 8],
        ],
      },
    ])

    const result = await new FakeHotspot().getGeoObjectsByCoords([40, 4])

    expect(result.map((item) => (item as { getId: () => string }).getId())).toEqual([
      'native',
      'nmap-uploader:note:first',
    ])
    adapter.destroy()
  })

  it('отключается и восстанавливает provider при нарушении runtime-контракта', async () => {
    class InvalidHotspot extends FakeHotspot {
      override getGeoObjectsByCoords(_coordinates: Coordinate): Promise<unknown[]> {
        return Promise.resolve('invalid' as unknown as unknown[])
      }
    }
    const original = InvalidHotspot.prototype.getGeoObjectsByCoords
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })
    installModules(globalObject, FakeGeometryFactory, InvalidHotspot)

    await new InvalidHotspot().getGeoObjectsByCoords([40, 6])

    expect(adapter.getCapability()).toBe('disabled')
    expect(InvalidHotspot.prototype.getGeoObjectsByCoords).toBe(original)
    expect(debug).toHaveBeenCalledWith('[nmap_uploader] native tracing unavailable')
    adapter.destroy()
  })

  it('destroy восстанавливает исходный prototype method', () => {
    const original = FakeHotspot.prototype.getGeoObjectsByCoords
    const globalObject: Record<string, unknown> = {}
    const adapter = createNativeTracingAdapter({ globalObject, getMap: createMap })
    installModules(globalObject)

    expect(FakeHotspot.prototype.getGeoObjectsByCoords).not.toBe(original)
    adapter.destroy()
    expect(FakeHotspot.prototype.getGeoObjectsByCoords).toBe(original)
  })
})
