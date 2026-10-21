import type { PolygonSnapTarget } from '@/lib/nmaps_draw_objects'
import { observeWebpackModules } from '@/lib/nmaps_webpack_module_observer'
import {
  getExportValues,
  isFunction,
  isGeometryFactoryConstructor,
  isHotspotConstructor,
  isNativeCandidate,
  isTracerHotspot,
} from './contracts'
import {
  buildTracingTargets,
  findNearestTracingTarget,
  mergeCandidateIfMissing,
} from './target_builder'
import type {
  Capability,
  Coordinate,
  GeometryFactoryConstructor,
  HotspotConstructor,
  HotspotMethod,
  NativeTracingAdapter,
  NativeTracingAdapterOptions,
  TracingTarget,
} from './types'

export * from './target_builder'

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
    targets = buildTracingTargets(pendingTargets, geometryFactoryConstructor, capability, disable)
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

        const nearest = findNearestTracingTarget(
          coordinates,
          targets,
          map,
          this.attrs?.hotspotWidth as number,
        )

        return mergeCandidateIfMissing(nativeCandidates, nearest)
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
