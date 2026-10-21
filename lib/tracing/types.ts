import type { PolygonSnapTarget } from '@/lib/nmaps_draw_objects'

export type Coordinate = [number, number]
export type Capability = 'pending' | 'active' | 'disabled'

export type NativeProjection = {
  toGlobalPixels: (coordinates: Coordinate, zoom: number) => number[]
}

export type NativeTracingMap = {
  getZoom: () => number
  options: {
    get: (name: 'projection') => NativeProjection
  }
}

export type NativeGeometry = {
  getCoordinates: () => unknown
  getType: () => string
  isTypeOf: (type: string) => boolean
}

export type GeometryFactory = {
  createPoint: (...args: unknown[]) => unknown
  createPolyline: (...args: unknown[]) => unknown
  createPolygon: (coordinates: Coordinate[][]) => NativeGeometry
  createCollection: (...args: unknown[]) => unknown
}

export type GeometryFactoryConstructor = new () => GeometryFactory

export type NativeCandidate = {
  getId: () => string
  getGeometry: () => NativeGeometry
}

export type HotspotInstance = {
  attrs?: {
    disabled?: unknown
    hotspotWidth?: unknown
    ignoreZMax?: unknown
    simplify?: unknown
    zIndex?: unknown
  }
}

export type HotspotMethod = (
  this: HotspotInstance,
  coordinates: Coordinate,
  ...args: unknown[]
) => Promise<unknown[]> | unknown[]

export type HotspotConstructor = {
  prototype: {
    getGeoObjectsByCoords: HotspotMethod
    onRender: (...args: unknown[]) => unknown
    onInit: (...args: unknown[]) => unknown
    onUnmount: (...args: unknown[]) => unknown
  }
}

export type NativeTracingAdapter = {
  setTargets: (targets: PolygonSnapTarget[]) => void
  getCapability: () => Capability
  destroy: () => void
}

export type TracingTarget = {
  payload: PolygonSnapTarget
  geometry: NativeGeometry
  candidate: NativeCandidate
}

export type NativeTracingAdapterOptions = {
  globalObject: Record<string, unknown>
  getMap: () => NativeTracingMap | null
}

export type SegmentSnap = {
  segmentIndex: number
  ratio: number
  distance: number
}
