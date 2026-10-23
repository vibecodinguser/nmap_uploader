import { vi } from 'vitest'
import type { NativeTracingMap } from '@/lib/nmaps_native_tracing_adapter'

export type Coordinate = [number, number]

export class FakePolygon {
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

export class FakeGeometryFactory {
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

export const nativeCandidate = {
  getId: () => 'native',
  getGeometry: () => new FakePolygon([[]]),
}

export class FakeHotspot {
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

export type Factory = (
  module: { exports: Record<string, unknown> },
  exports: Record<string, unknown>,
  require: unknown,
) => void

export type Chunk = [number[], Record<string, Factory>]

export const tracingTarget = {
  id: 'polygon',
  coordinates: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 0],
  ] as Coordinate[],
}

export const createTracingMap = (): NativeTracingMap => ({
  getZoom: () => 18,
  options: {
    get: () => ({
      toGlobalPixels: (coordinates: Coordinate) => coordinates,
    }),
  },
})

export const installTracingModules = (
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
