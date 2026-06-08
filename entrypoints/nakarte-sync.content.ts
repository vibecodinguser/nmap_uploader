import { defineContentScript } from 'wxt/utils/define-content-script'
import { mouseToLatLng } from '@/lib/go_to_geo_projection'
import type { MapLocation } from '@/lib/go_to_link'
import { getMapLocationFromNakarteUrl, NAKARTE_SYNC_MSG_SOURCE } from '@/lib/go_to_map_sync'

const MAP_ELEMENT_ID = 'map'

const postToParent = (message: {
  type: 'location' | 'cursor'
  location: MapLocation | null
}): void => {
  window.parent.postMessage({ source: NAKARTE_SYNC_MSG_SOURCE, ...message }, '*')
}

const getMapElement = (): HTMLElement | null => document.getElementById(MAP_ELEMENT_ID)

const readLocation = (): MapLocation | null => getMapLocationFromNakarteUrl(window.location.href)

const notifyLocation = (): void => {
  const location = readLocation()
  if (!location) return
  postToParent({ type: 'location', location })
}

export default defineContentScript({
  matches: ['https://nakarte.me/*', 'http://nakarte.me/*'],
  runAt: 'document_idle',
  allFrames: true,

  main(ctx) {
    if (window.self === window.top) return

    const restorePushState = wrapHistoryMethod('pushState', notifyLocation)
    const restoreReplaceState = wrapHistoryMethod('replaceState', notifyLocation)

    const handleMapMouseMove = (event: MouseEvent): void => {
      const mapElement = getMapElement()
      if (!mapElement) return

      const view = readLocation()
      if (!view) return

      const rect = mapElement.getBoundingClientRect()
      const cursor = mouseToLatLng(event.clientX - rect.left, event.clientY - rect.top, view, {
        width: rect.width,
        height: rect.height,
      })
      postToParent({ type: 'cursor', location: cursor })
    }

    const handleMapMouseLeave = (): void => {
      postToParent({ type: 'cursor', location: null })
    }

    const bindMapPointerEvents = (): void => {
      const mapElement = getMapElement()
      if (!mapElement || mapElement.dataset.nmapUploaderPointerBound === 'true') return

      mapElement.dataset.nmapUploaderPointerBound = 'true'
      mapElement.addEventListener('mousemove', handleMapMouseMove)
      mapElement.addEventListener('mouseleave', handleMapMouseLeave)
    }

    window.addEventListener('hashchange', notifyLocation)
    window.addEventListener('popstate', notifyLocation)

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindMapPointerEvents, { once: true })
    } else {
      bindMapPointerEvents()
    }

    queueMicrotask(notifyLocation)

    ctx.onInvalidated(() => {
      restorePushState()
      restoreReplaceState()
      window.removeEventListener('hashchange', notifyLocation)
      window.removeEventListener('popstate', notifyLocation)
      const mapElement = getMapElement()
      mapElement?.removeEventListener('mousemove', handleMapMouseMove)
      mapElement?.removeEventListener('mouseleave', handleMapMouseLeave)
    })
  },
})

const wrapHistoryMethod = (
  method: 'pushState' | 'replaceState',
  onChange: () => void,
): (() => void) => {
  const original = history[method].bind(history) as History['pushState']

  history[method] = ((...args: Parameters<History['pushState']>) => {
    original(...args)
    queueMicrotask(onChange)
  }) as History['pushState']

  return () => {
    history[method] = original
  }
}
