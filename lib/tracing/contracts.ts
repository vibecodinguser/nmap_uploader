import type {
  GeometryFactoryConstructor,
  HotspotConstructor,
  HotspotInstance,
  NativeCandidate,
} from './types'

export const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function'

export const isGeometryFactoryConstructor = (
  value: unknown,
): value is GeometryFactoryConstructor => {
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

export const isHotspotConstructor = (value: unknown): value is HotspotConstructor => {
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

export const getExportValues = (exports: unknown): unknown[] => {
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

export const isNativeCandidate = (value: unknown): value is NativeCandidate =>
  Boolean(
    value &&
      typeof value === 'object' &&
      isFunction((value as Record<string, unknown>).getId) &&
      isFunction((value as Record<string, unknown>).getGeometry),
  )

export const isTracerHotspot = (instance: HotspotInstance): boolean => {
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
