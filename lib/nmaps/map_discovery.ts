/**
 * Адаптер обнаружения и перехвата карты ymaps на странице Народной карты.
 */

import { isValidMapView } from '@/lib/nmaps/projection'
import { notifyNmapsBoundsChange } from '@/lib/nmaps_bounds_notify'

export const MAP_DISCOVERY_POLL_MS = 500
export const MAP_DISCOVERY_TIMEOUT_MS = 30_000

export type YmapsMapLike = {
  getCenter: () => [number, number]
  getZoom: () => number
  events: {
    add: (event: string, handler: (...args: unknown[]) => void) => void
    remove: (event: string, handler: (...args: unknown[]) => void) => void
  }
}

export type YmapsGlobal = {
  Map?: new (...args: unknown[]) => YmapsMapLike
  ready?: (callback: () => void) => void
}

export type YmapsMapWithContainer = {
  container?: { fitToViewport?: () => void }
}

export const isNonNullObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const hasYmapsEventsAdd = (record: Record<string, unknown>): boolean => {
  const events = record.events
  return isNonNullObject(events) && typeof events.add === 'function'
}

export const isYmapsMapLike = (value: unknown): value is YmapsMapLike => {
  return (
    isNonNullObject(value) &&
    typeof value.getCenter === 'function' &&
    typeof value.getZoom === 'function' &&
    hasYmapsEventsAdd(value)
  )
}

export const findMapInElement = (element: Element): YmapsMapLike | null => {
  for (const key in element) {
    try {
      const value = (element as unknown as Record<string, unknown>)[key]
      if (isYmapsMapLike(value)) {
        return value
      }
    } catch {
      // Ignored cross-origin or illegal invocation errors
    }
  }
  return null
}

export const findMapInSelector = (selector: string): YmapsMapLike | null => {
  const elements = document.querySelectorAll(selector)
  for (let index = 0; index < elements.length; index += 1) {
    const candidate = findMapInElement(elements[index])
    if (candidate) {
      return candidate
    }
  }
  return null
}

export const findMapInstanceFromDom = (): YmapsMapLike | null => {
  const selectors = [
    "[class*='ymaps-2'][class*='-map']",
    "[class*='ymaps'][class*='map']",
    '.ymaps-map',
    '.nk-map *',
    '[class*="ymaps"]',
  ]

  for (const selector of selectors) {
    const candidate = findMapInSelector(selector)
    if (candidate) {
      return candidate
    }
  }

  return null
}

export const findMapFromGlobalYmaps = (): YmapsMapLike | null => {
  const windowRecord = globalThis as unknown as Record<string, unknown>
  const ymaps = windowRecord.ymaps as YmapsGlobal | undefined
  if (ymaps) {
    return findMapInstanceFromDom()
  }
  return null
}

export const findActiveMap = (): YmapsMapLike | null => {
  return findMapFromGlobalYmaps() ?? findMapInstanceFromDom()
}

export const subscribeToMapEvents = (map: YmapsMapLike): void => {
  const handleBoundsChange = (): void => {
    try {
      const center = map.getCenter()
      const zoom = map.getZoom()
      if (isValidMapView(center, zoom)) {
        notifyNmapsBoundsChange({
          latitude: center[0],
          longitude: center[1],
          zoom,
        })
      }
    } catch (e: unknown) {
      console.debug(e)
    }
  }

  map.events.add('boundschange', handleBoundsChange)
  map.events.add('actiontick', handleBoundsChange)
}
