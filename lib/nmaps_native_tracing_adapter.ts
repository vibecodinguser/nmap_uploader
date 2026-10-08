import type { PolygonSnapTarget } from '@/lib/nmaps_draw_objects'
import { observeWebpackModules } from '@/lib/nmaps_webpack_module_observer'

type Coordinate = [number, number]
type Capability = 'pending' | 'active' | 'disabled'

type NativeProjection = {
  toGlobalPixels: (coordinates: Coordinate, zoom: number) => number[]
}

export type NativeTracingMap = {
  getZoom: () => number
  options: {
    get: (name: 'projection') => NativeProjection
  }
}

type NativeGeometry = {
  getCoordinates: () => unknown
  getType: () => string
  isTypeOf: (type: string) => boolean
}

type GeometryFactory = {
  createPoint: (...args: unknown[]) => unknown
  createPolyline: (...args: unknown[]) => unknown
  createPolygon: (coordinates: Coordinate[][]) => NativeGeometry
  createCollection: (...args: unknown[]) => unknown
}

type GeometryFactoryConstructor = new () => GeometryFactory

type NativeCandidate = {
  getId: () => string
  getGeometry: () => NativeGeometry
}

type HotspotInstance = {
  attrs?: {
    disabled?: unknown
    hotspotWidth?: unknown
    ignoreZMax?: unknown
    simplify?: unknown
    zIndex?: unknown
  }
}

type HotspotMethod = (
  this: HotspotInstance,
  coordinates: Coordinate,
  ...args: unknown[]
) => Promise<unknown[]> | unknown[]

type HotspotConstructor = {
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

type TracingTarget = {
  payload: PolygonSnapTarget
  geometry: NativeGeometry
  candidate: NativeCandidate
}

type NativeTracingAdapterOptions = {
  globalObject: Record<string, unknown>
  getMap: () => NativeTracingMap | null
}

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function'

const isGeometryFactoryConstructor = (value: unknown): value is GeometryFactoryConstructor => {
  if (!isFunction(value)) {
    return false
  }
  const prototype = value.prototype as Record<string, unknown> | undefined
  return Boolean(
    prototype &&
      isFunction(prototype.createPoint) &&
      isFunction(prototype.createPolyline) &&
      isFunction(prototype.createPolygon) &&
      isFunction(prototype.createCollection),
  )
}

const isHotspotConstructor = (value: unknown): value is HotspotConstructor => {
  if (!isFunction(value)) {
    return false
  }
  const prototype = value.prototype as Record<string, unknown> | undefined
  return Boolean(
    prototype &&
      isFunction(prototype.getGeoObjectsByCoords) &&
      isFunction(prototype.onRender) &&
      isFunction(prototype.onInit) &&
      isFunction(prototype.onUnmount),
  )
}

const getExportValues = (exports: unknown): unknown[] => {
  if (isFunction(exports)) {
    return [exports]
  }
  if (!exports || typeof exports !== 'object') {
    return []
  }
  try {
    return Object.values(exports)
  } catch {
    return []
  }
}

const isNativeCandidate = (value: unknown): value is NativeCandidate =>
  Boolean(
    value &&
      typeof value === 'object' &&
      isFunction((value as Record<string, unknown>).getId) &&
      isFunction((value as Record<string, unknown>).getGeometry),
  )

const isTracerHotspot = (instance: HotspotInstance): boolean => {
  const attrs = instance.attrs
  return Boolean(
    attrs &&
      attrs.disabled === true &&
      attrs.hotspotWidth === 10 &&
      attrs.ignoreZMax === true &&
      attrs.simplify === false &&
      attrs.zIndex === -1,
  )
}

type SegmentSnap = {
  segmentIndex: number
  ratio: number
  distance: number
}

const snapToSegment = (
  point: number[],
  start: number[],
  end: number[],
): Omit<SegmentSnap, 'segmentIndex'> => {
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  const squaredLength = deltaX * deltaX + deltaY * deltaY
  if (squaredLength === 0) {
    return {
      ratio: 0,
      distance: Math.hypot(point[0] - start[0], point[1] - start[1]),
    }
  }
  const ratio = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY) / squaredLength),
  )
  return {
    ratio,
    distance: Math.hypot(
      point[0] - (start[0] + ratio * deltaX),
      point[1] - (start[1] + ratio * deltaY),
    ),
  }
}

const findTargetSnap = (
  cursor: Coordinate,
  coordinates: Coordinate[],
  map: NativeTracingMap,
  threshold: number,
): SegmentSnap | null => {
  const zoom = map.getZoom()
  const projection = map.options.get('projection')
  const cursorPixels = projection.toGlobalPixels(cursor, zoom)
  const vertices = coordinates.map((coordinate) => projection.toGlobalPixels(coordinate, zoom))
  let nearest: SegmentSnap | null = null

  for (let index = 1; index < vertices.length; index += 1) {
    const current = snapToSegment(cursorPixels, vertices[index - 1], vertices[index])
    if (current.distance <= threshold && (!nearest || current.distance < nearest.distance)) {
      nearest = { ...current, segmentIndex: index - 1 }
    }
  }
  if (!nearest) {
    return null
  }
  return nearest
}

export const createNativeTracingAdapter = ({
  globalObject,
  getMap,
}: NativeTracingAdapterOptions): NativeTracingAdapter => {
  let capability: Capability = 'pending'
  let pendingTargets: PolygonSnapTarget[] = []
  let targets: TracingTarget[] = []
  let geometryFactoryConstructor: GeometryFactoryConstructor | null = null
  let hotspotConstructor: HotspotConstructor | null = null
  let restoreProvider: (() => void) | null = null
  let destroyed = false
  let diagnosticWritten = false

  const writeDiagnostic = (): void => {
    if (!diagnosticWritten) {
      diagnosticWritten = true
      console.debug('[nmap_uploader] native tracing unavailable')
    }
  }

  const restoreOriginalProvider = (): void => {
    restoreProvider?.()
    restoreProvider = null
  }

  let restoreObserver = (): void => {}

  const disable = (): void => {
    if (capability === 'disabled') {
      return
    }
    capability = 'disabled'
    pendingTargets = []
    targets = []
    restoreOriginalProvider()
    restoreObserver()
    writeDiagnostic()
  }

  const refreshTargets = (): void => {
    targets = []
    if (!geometryFactoryConstructor || capability === 'disabled') {
      return
    }

    let geometryFactory: GeometryFactory
    try {
      geometryFactory = new geometryFactoryConstructor()
    } catch {
      disable()
      return
    }

    for (const nextTarget of pendingTargets) {
      try {
        const payload = {
          id: nextTarget.id,
          coordinates: nextTarget.coordinates.map(
            ([longitude, latitude]) => [longitude, latitude] as Coordinate,
          ),
        }
        const geometry = geometryFactory.createPolygon([payload.coordinates])
        if (
          !geometry ||
          geometry.getType() !== 'Polygon' ||
          !geometry.isTypeOf('Polygon') ||
          !Array.isArray(geometry.getCoordinates())
        ) {
          continue
        }
        const id = `nmap-uploader:note:${payload.id}`
        const candidate = Object.freeze({
          getId: () => id,
          getGeometry: () => geometry,
        })
        targets.push({ payload, geometry, candidate })
      } catch {}
    }
  }

  const activate = (): void => {
    if (
      destroyed ||
      capability !== 'pending' ||
      !geometryFactoryConstructor ||
      !hotspotConstructor
    ) {
      return
    }

    const prototype = hotspotConstructor.prototype
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'getGeoObjectsByCoords')
    if (!descriptor || !isFunction(descriptor.value)) {
      disable()
      return
    }
    const original = descriptor.value as HotspotMethod

    const wrapped: HotspotMethod = function (coordinates, ...args) {
      const originalResult = Reflect.apply(original, this, [coordinates, ...args])
      return Promise.resolve(originalResult).then((nativeCandidates) => {
        if (!Array.isArray(nativeCandidates) || !nativeCandidates.every(isNativeCandidate)) {
          disable()
          return nativeCandidates
        }
        if (targets.length === 0 || !isTracerHotspot(this)) {
          return nativeCandidates
        }

        const map = getMap()
        if (!map) {
          return nativeCandidates
        }
        let nearest: { target: TracingTarget; distance: number } | null = null
        try {
          for (const tracingTarget of targets) {
            const snap = findTargetSnap(
              coordinates,
              tracingTarget.payload.coordinates,
              map,
              this.attrs?.hotspotWidth as number,
            )
            if (snap && (!nearest || snap.distance < nearest.distance)) {
              nearest = { target: tracingTarget, distance: snap.distance }
            }
          }
        } catch {
          return nativeCandidates
        }
        if (
          !nearest ||
          nativeCandidates.some((item) => item.getId() === nearest?.target.candidate.getId())
        ) {
          return nativeCandidates
        }

        return [...nativeCandidates, nearest.target.candidate]
      })
    }

    Object.defineProperty(prototype, 'getGeoObjectsByCoords', {
      ...descriptor,
      value: wrapped,
    })
    restoreProvider = () => {
      Object.defineProperty(prototype, 'getGeoObjectsByCoords', descriptor)
    }
    capability = 'active'
    refreshTargets()
  }

  restoreObserver = observeWebpackModules(globalObject, 'webpackChunknmaps', (moduleExports) => {
    if (capability !== 'pending') {
      return
    }
    for (const value of getExportValues(moduleExports)) {
      if (!geometryFactoryConstructor && isGeometryFactoryConstructor(value)) {
        geometryFactoryConstructor = value
      }
      if (!hotspotConstructor && isHotspotConstructor(value)) {
        hotspotConstructor = value
      }
    }
    activate()
  })

  return {
    setTargets(nextTargets) {
      pendingTargets = nextTargets.map((target) => ({
        id: target.id,
        coordinates: target.coordinates.map(
          ([longitude, latitude]) => [longitude, latitude] as Coordinate,
        ),
      }))
      refreshTargets()
    },
    getCapability() {
      return capability
    },
    destroy() {
      if (destroyed) {
        return
      }
      destroyed = true
      pendingTargets = []
      targets = []
      restoreOriginalProvider()
      restoreObserver()
    },
  }
}
