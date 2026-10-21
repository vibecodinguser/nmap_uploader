import { NMAPS_ORIGIN } from '@/lib/extension_origins'
import { mouseToLatLng } from '@/lib/go_to_geo_projection'
import type { MapLocation } from '@/lib/go_to_link'
import { getMapLocationFromNakarteUrl, NAKARTE_SYNC_MSG_SOURCE } from '@/lib/go_to_map_sync'

export const MAP_ELEMENT_ID = 'map'

export class NakarteSyncService {
  private restorePushState?: () => void
  private restoreReplaceState?: () => void

  public start(): () => void {
    this.restorePushState = this.wrapHistoryMethod('pushState', this.notifyLocation)
    this.restoreReplaceState = this.wrapHistoryMethod('replaceState', this.notifyLocation)

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', this.notifyLocation)
      window.addEventListener('popstate', this.notifyLocation)
    }

    this.scheduleMapPointerBinding()
    queueMicrotask(this.notifyLocation)

    return () => {
      this.stop()
    }
  }

  public stop = (): void => {
    this.restorePushState?.()
    this.restoreReplaceState?.()
    this.restorePushState = undefined
    this.restoreReplaceState = undefined

    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', this.notifyLocation)
      window.removeEventListener('popstate', this.notifyLocation)
    }

    const mapElement = this.getMapElement()
    if (mapElement) {
      mapElement.removeEventListener('mousemove', this.handleMapMouseMove)
      mapElement.removeEventListener('mouseleave', this.handleMapMouseLeave)
      delete mapElement.dataset.nmapUploaderPointerBound
    }
  }

  public postToParent = (message: {
    type: 'location' | 'cursor'
    location: MapLocation | null
  }): void => {
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({ source: NAKARTE_SYNC_MSG_SOURCE, ...message }, NMAPS_ORIGIN)
    }
  }

  public getMapElement = (): HTMLElement | null => {
    return typeof document !== 'undefined' ? document.getElementById(MAP_ELEMENT_ID) : null
  }

  public readLocation = (): MapLocation | null => {
    return typeof window !== 'undefined' ? getMapLocationFromNakarteUrl(window.location.href) : null
  }

  public notifyLocation = (): void => {
    const location = this.readLocation()
    if (location) {
      this.postToParent({ type: 'location', location })
    }
  }

  public handleMapMouseLeave = (): void => {
    this.postToParent({ type: 'cursor', location: null })
  }

  public handleMapMouseMove = (event: MouseEvent): void => {
    const mapElement = this.getMapElement()
    const view = this.readLocation()
    if (mapElement && view) {
      const rect = mapElement.getBoundingClientRect()
      const cursor = mouseToLatLng(event.clientX - rect.left, event.clientY - rect.top, view, {
        width: rect.width,
        height: rect.height,
      })
      this.postToParent({ type: 'cursor', location: cursor })
    }
  }

  public bindMapPointerEvents = (): void => {
    const mapElement = this.getMapElement()
    if (mapElement && mapElement.dataset.nmapUploaderPointerBound !== 'true') {
      mapElement.dataset.nmapUploaderPointerBound = 'true'
      mapElement.addEventListener('mousemove', this.handleMapMouseMove)
      mapElement.addEventListener('mouseleave', this.handleMapMouseLeave)
    }
  }

  private scheduleMapPointerBinding(): void {
    if (typeof document === 'undefined') return

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.bindMapPointerEvents, { once: true })
    } else {
      this.bindMapPointerEvents()
    }
  }

  private wrapHistoryMethod(
    method: 'pushState' | 'replaceState',
    onChange: () => void,
  ): () => void {
    if (typeof history === 'undefined') return () => {}

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
}
