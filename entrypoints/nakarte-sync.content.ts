import { defineContentScript } from 'wxt/utils/define-content-script'
import { NMAPS_ORIGIN } from '@/lib/extension_origins'
import { mouseToLatLng } from '@/lib/go_to_geo_projection'
import type { MapLocation } from '@/lib/go_to_link'
import { getMapLocationFromNakarteUrl, NAKARTE_SYNC_MSG_SOURCE } from '@/lib/go_to_map_sync'

const MAP_ELEMENT_ID = 'map'

const postToParent = (message: {
  type: 'location' | 'cursor'
  location: MapLocation | null
}): void => {
  window.parent.postMessage({ source: NAKARTE_SYNC_MSG_SOURCE, ...message }, NMAPS_ORIGIN)
}

const getMapElement = (): HTMLElement | null => document.getElementById(MAP_ELEMENT_ID)

const readLocation = (): MapLocation | null => getMapLocationFromNakarteUrl(window.location.href)

const notifyLocation = (): void => {
  const location = readLocation()
  if (location) {
    postToParent({ type: 'location', location })
  }
}

const handleMapMouseLeave = (): void => {
  postToParent({ type: 'cursor', location: null })
}

const handleMapMouseMove = (event: MouseEvent): void => {
  const mapElement = getMapElement()
  const view = readLocation()
  if (mapElement && view) {
    const rect = mapElement.getBoundingClientRect()
    const cursor = mouseToLatLng(event.clientX - rect.left, event.clientY - rect.top, view, {
      width: rect.width,
      height: rect.height,
    })
    postToParent({ type: 'cursor', location: cursor })
  }
}

const bindMapPointerEvents = (): void => {
  const mapElement = getMapElement()
  if (mapElement && mapElement.dataset.nmapUploaderPointerBound !== 'true') {
    mapElement.dataset.nmapUploaderPointerBound = 'true'
    mapElement.addEventListener('mousemove', handleMapMouseMove)
    mapElement.addEventListener('mouseleave', handleMapMouseLeave)
  }
}

const scheduleMapPointerBinding = (): void => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMapPointerEvents, { once: true })
  } else {
    bindMapPointerEvents()
  }
}

const wrapHistoryMethod = (
  method: 'pushState' | 'replaceState',
  onChange: () => void,
): (() => void) => {
  const original = history[method].bind(history) as History['pushState']

  const historyMethodWrapper = function historyMethodWrapper(
    ...args: Parameters<History['pushState']>
  ): void {
    original(...args)
    queueMicrotask(onChange)
  }

  history[method] = historyMethodWrapper as History['pushState']

  return function restoreHistoryMethod(): void {
    history[method] = original
  }
}

let restoreNakartePushState: (() => void) | undefined
let restoreNakarteReplaceState: (() => void) | undefined

const handleNakarteSyncInvalidation = (): void => {
  restoreNakartePushState?.()
  restoreNakarteReplaceState?.()
  window.removeEventListener('hashchange', notifyLocation)
  window.removeEventListener('popstate', notifyLocation)
  const mapElement = getMapElement()
  if (mapElement) {
    mapElement.removeEventListener('mousemove', handleMapMouseMove)
    mapElement.removeEventListener('mouseleave', handleMapMouseLeave)
  }
  restoreNakartePushState = undefined
  restoreNakarteReplaceState = undefined
}

const startNakarteSync = (ctx: { onInvalidated: (callback: () => void) => void }): void => {
  restoreNakartePushState = wrapHistoryMethod('pushState', notifyLocation)
  restoreNakarteReplaceState = wrapHistoryMethod('replaceState', notifyLocation)

  window.addEventListener('hashchange', notifyLocation)
  window.addEventListener('popstate', notifyLocation)
  scheduleMapPointerBinding()
  queueMicrotask(notifyLocation)
  ctx.onInvalidated(handleNakarteSyncInvalidation)
}

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://nakarte.me/*'],
  runAt: 'document_idle',
  allFrames: true,

  main(ctx) {
    if (window.self !== window.top) {
      startNakarteSync(ctx)
    }
  },
})
