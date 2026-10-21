/**
 * Управление синхронизацией координат и подписками на события в сплит-режиме Go To.
 */
import { isNakarteOrigin, NAKARTE_ORIGIN } from '@/lib/extension_origins'
import { latLngToPanelPixel, mouseToLatLng } from '@/lib/go_to_geo_projection'
import { getMapLocationFromUrl, type MapLocation } from '@/lib/go_to_link'
import {
  buildNmapsUrlFromLocation,
  locationsEqual,
  NAKARTE_SYNC_MSG_SOURCE,
  NMAP_UPLOADER_MSG_SOURCE,
  normalizeMapLocation,
  normalizeMapZoom,
  type SplitLocationMessage,
} from '@/lib/go_to_map_sync'
import { GO_TO_SPLIT_BUTTON_ID } from '@/lib/go_to_split_button'
import {
  calculateWheelZoomSteps,
  clampMarkerPosition,
  isStaleNakarteZoomEcho,
  NAKARTE_ZOOM_PUSH_GRACE_MS,
  SYNC_DEBOUNCE_MS,
  URL_POLL_INTERVAL_MS,
} from '@/lib/go_to_split_view/core'
import {
  getLeftPanelSize,
  getRightPanelSize,
  type SplitDomElements,
  setMarkerElementPosition,
} from '@/lib/go_to_split_view/dom'
import { GO_TO_SPLIT_BUTTON_ACTIVE_CLASS } from '@/lib/go_to_styles'
import { NMAPS_BOUNDS_CHANGE_EVENT, parseBoundsChangeEvent } from '@/lib/nmaps_bounds_notify'
import { NMAPS_URL_CHANGE_EVENT } from '@/lib/nmaps_url_notify'

export const getSplitButton = (): HTMLButtonElement | null =>
  document.getElementById(GO_TO_SPLIT_BUTTON_ID) as HTMLButtonElement | null

export const updateSplitButtonState = (isOpen: boolean): void => {
  const button = getSplitButton()
  if (!button) return

  button.classList.toggle(GO_TO_SPLIT_BUTTON_ACTIVE_CLASS, isOpen)
  button.setAttribute('aria-pressed', String(isOpen))
}

export const postLocationToIframe = (
  iframe: HTMLIFrameElement | null,
  location: MapLocation,
): void => {
  const normalized = normalizeMapLocation(location)
  iframe?.contentWindow?.postMessage(
    {
      source: NMAP_UPLOADER_MSG_SOURCE,
      type: 'set_location',
      location: normalized,
    },
    NAKARTE_ORIGIN,
  )
}

export const wrapHistoryMethod = (
  method: 'pushState' | 'replaceState',
  onChange: () => void,
): (() => void) => {
  const original = history[method].bind(history) as History['pushState']

  history[method] = ((...args: Parameters<History['pushState']>) => {
    original(...args)
    onChange()
  }) as History['pushState']

  return () => {
    history[method] = original
  }
}

export const readNmapsLocation = (): MapLocation | null =>
  getMapLocationFromUrl(window.location.href)

export class SplitSyncManager {
  private syncTimer: ReturnType<typeof setTimeout> | undefined
  private urlPollTimer: ReturnType<typeof setInterval> | undefined
  private pendingNakarteZoomPushTimer: ReturnType<typeof setTimeout> | undefined
  private wheelZoomAccumulator = 0
  private lastPolledUrlLocation: MapLocation | null = null
  private lastPushedZoom: number | null = null
  private pendingNakarteZoomPush: MapLocation | null = null
  private nmapsLocation: MapLocation | null = null
  private nakarteLocation: MapLocation | null = null
  private cleanupFns: Array<() => void> = []

  constructor(
    private readonly dom: SplitDomElements,
    initialLocation: MapLocation,
  ) {
    this.nmapsLocation = initialLocation
    this.nakarteLocation = initialLocation
    this.lastPolledUrlLocation = normalizeMapLocation(initialLocation)
    this.lastPushedZoom = normalizeMapLocation(initialLocation).zoom
  }

  public initListeners(): void {
    const onNmapsUrlChange = () => this.syncNmapsLocationToNakarte()

    const restorePushState = wrapHistoryMethod('pushState', onNmapsUrlChange)
    const restoreReplaceState = wrapHistoryMethod('replaceState', onNmapsUrlChange)

    const handleMouseMove = (e: MouseEvent) => this.handleNmapsMouseMove(e)
    const handleMouseLeave = () => this.handleNmapsMouseLeave()
    const handleMessage = (e: MessageEvent) => this.handleWindowMessage(e)
    const handleWheel = (e: WheelEvent) => this.handleNmapsWheel(e)
    const handleBoundsChange = (e: Event) => this.handleNmapsBoundsChange(e)

    window.addEventListener('popstate', onNmapsUrlChange)
    window.addEventListener('hashchange', onNmapsUrlChange)
    document.addEventListener(NMAPS_URL_CHANGE_EVENT, onNmapsUrlChange)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('message', handleMessage)
    window.addEventListener('wheel', handleWheel, { passive: true, capture: true })
    document.addEventListener(NMAPS_BOUNDS_CHANGE_EVENT, handleBoundsChange)

    this.urlPollTimer = setInterval(() => this.syncNmapsLocationToNakarte(), URL_POLL_INTERVAL_MS)

    this.cleanupFns = [
      restorePushState,
      restoreReplaceState,
      () => window.removeEventListener('popstate', onNmapsUrlChange),
      () => window.removeEventListener('hashchange', onNmapsUrlChange),
      () => document.removeEventListener(NMAPS_URL_CHANGE_EVENT, onNmapsUrlChange),
      () => window.removeEventListener('mousemove', handleMouseMove),
      () => window.removeEventListener('mouseleave', handleMouseLeave),
      () => window.removeEventListener('message', handleMessage),
      () => window.removeEventListener('wheel', handleWheel, true),
      () => document.removeEventListener(NMAPS_BOUNDS_CHANGE_EVENT, handleBoundsChange),
      () => {
        if (!this.urlPollTimer) return
        clearInterval(this.urlPollTimer)
        this.urlPollTimer = undefined
      },
      () => {
        this.wheelZoomAccumulator = 0
      },
    ]
  }

  public postInitialLocation(): void {
    if (this.nmapsLocation) {
      postLocationToIframe(this.dom.iframe, this.nmapsLocation)
    }
  }

  public hideCursorMarkers(): void {
    this.hideLeftCursorMarker()
    this.hideRightCursorMarker()
  }

  public hideLeftCursorMarker(): void {
    setMarkerElementPosition(this.dom.leftCursorMarker, null)
  }

  public hideRightCursorMarker(): void {
    setMarkerElementPosition(this.dom.rightCursorMarker, null)
  }

  public dispose(): void {
    clearTimeout(this.syncTimer)
    this.syncTimer = undefined
    this.lastPushedZoom = null
    this.clearPendingNakarteZoomPush()

    for (const cleanup of this.cleanupFns) cleanup()
    this.cleanupFns = []

    this.nmapsLocation = null
    this.nakarteLocation = null
    this.lastPolledUrlLocation = null
  }

  private updateRightCursorFromGeo(location: MapLocation | null): void {
    const panel = getRightPanelSize()
    if (!location || !this.nakarteLocation) {
      this.hideRightCursorMarker()
      return
    }

    const pixel = latLngToPanelPixel(location, this.nakarteLocation, panel)
    if (!pixel) {
      this.hideRightCursorMarker()
      return
    }

    const clamped = clampMarkerPosition(pixel, panel)
    setMarkerElementPosition(this.dom.rightCursorMarker, clamped)
  }

  private updateLeftCursorFromGeo(location: MapLocation | null): void {
    const panel = getLeftPanelSize()
    if (!location || !this.nmapsLocation) {
      this.hideLeftCursorMarker()
      return
    }

    const pixel = latLngToPanelPixel(location, this.nmapsLocation, panel)
    if (!pixel) {
      this.hideLeftCursorMarker()
      return
    }

    const clamped = clampMarkerPosition(pixel, panel)
    setMarkerElementPosition(this.dom.leftCursorMarker, clamped)
  }

  private markPendingNakarteZoomPush(location: MapLocation): void {
    this.pendingNakarteZoomPush = normalizeMapLocation(location)
    clearTimeout(this.pendingNakarteZoomPushTimer)
    this.pendingNakarteZoomPushTimer = setTimeout(() => {
      this.pendingNakarteZoomPush = null
      this.pendingNakarteZoomPushTimer = undefined
    }, NAKARTE_ZOOM_PUSH_GRACE_MS)
  }

  private clearPendingNakarteZoomPush(): void {
    this.pendingNakarteZoomPush = null
    clearTimeout(this.pendingNakarteZoomPushTimer)
    this.pendingNakarteZoomPushTimer = undefined
  }

  public pushLocationToNakarte(location: MapLocation, immediate = false): void {
    const normalized = normalizeMapLocation(location)
    if (locationsEqual(normalized, this.nakarteLocation)) return

    this.nmapsLocation = normalized

    const isPanOnlyChange =
      this.nakarteLocation !== null &&
      normalized.zoom === this.nakarteLocation.zoom &&
      !locationsEqual(normalized, this.nakarteLocation)
    const shouldSendImmediately = immediate || isPanOnlyChange

    const send = (): void => {
      const zoomChanged = this.lastPushedZoom !== null && this.lastPushedZoom !== normalized.zoom
      this.lastPushedZoom = normalized.zoom

      if (zoomChanged) {
        this.markPendingNakarteZoomPush(normalized)
      }

      postLocationToIframe(this.dom.iframe, normalized)
      this.nakarteLocation = normalized
    }

    clearTimeout(this.syncTimer)
    if (shouldSendImmediately) {
      send()
      return
    }

    this.syncTimer = setTimeout(send, SYNC_DEBOUNCE_MS)
  }

  private scheduleSyncFromNakarte(location: MapLocation): void {
    const normalized = normalizeMapLocation(location)
    if (locationsEqual(normalized, this.nmapsLocation)) return

    this.nakarteLocation = normalized
    clearTimeout(this.syncTimer)

    const applyToNmaps = (): void => {
      this.updateNmapsUrl(normalized)
      this.nmapsLocation = normalized
    }

    const isPanOnlyChange =
      this.nmapsLocation !== null && normalized.zoom === this.nmapsLocation.zoom

    if (isPanOnlyChange) {
      applyToNmaps()
      return
    }

    this.syncTimer = setTimeout(applyToNmaps, SYNC_DEBOUNCE_MS)
  }

  private updateNmapsUrl(location: MapLocation): void {
    const nextHref = buildNmapsUrlFromLocation(location, window.location.href)
    if (nextHref === window.location.href) return
    history.replaceState(history.state, '', nextHref)
    this.nmapsLocation = location
  }

  private resolveLocationForNakarteSync(urlLocation: MapLocation): MapLocation {
    const normalized = normalizeMapLocation(urlLocation)
    const urlZoomChanged =
      this.lastPolledUrlLocation !== null && this.lastPolledUrlLocation.zoom !== normalized.zoom
    this.lastPolledUrlLocation = normalized

    if (!this.nmapsLocation || normalized.zoom === this.nmapsLocation.zoom) {
      return normalized
    }

    if (urlZoomChanged) {
      return normalized
    }

    return { ...normalized, zoom: this.nmapsLocation.zoom }
  }

  private syncNmapsLocationToNakarte(): void {
    const location = readNmapsLocation()
    if (!location) return
    this.pushLocationToNakarte(this.resolveLocationForNakarteSync(location))
  }

  private handleNmapsBoundsChange(event: Event): void {
    const location = parseBoundsChangeEvent(event)
    if (!location) return
    this.pushLocationToNakarte(location, true)
  }

  private handleNmapsWheel(event: WheelEvent): void {
    if (!this.nmapsLocation) return

    const { steps, newAccumulator } = calculateWheelZoomSteps(
      event.deltaY,
      this.wheelZoomAccumulator,
    )
    this.wheelZoomAccumulator = newAccumulator
    if (steps === 0) return

    const nextZoom = normalizeMapZoom(this.nmapsLocation.zoom - steps)
    if (nextZoom === this.nmapsLocation.zoom) return

    this.pushLocationToNakarte({ ...this.nmapsLocation, zoom: nextZoom }, true)
  }

  private handleNmapsMouseMove(event: MouseEvent): void {
    const view = readNmapsLocation()
    if (!view) return

    const panel = getLeftPanelSize()
    const { clientX, clientY } = event
    if (clientX < 0 || clientX > panel.width || clientY < 0 || clientY > panel.height) {
      this.hideRightCursorMarker()
      return
    }

    const cursor = mouseToLatLng(clientX, clientY, view, panel)
    this.updateRightCursorFromGeo(cursor)
  }

  private handleNmapsMouseLeave(): void {
    this.hideRightCursorMarker()
  }

  private handleWindowMessage(event: MessageEvent): void {
    const data = event.data as SplitLocationMessage | undefined
    if (!data || data.source !== NAKARTE_SYNC_MSG_SOURCE) return
    if (!isNakarteOrigin(event.origin)) return
    if (event.source !== this.dom.iframe?.contentWindow) return

    if (data.type === 'location' && data.location) {
      if (
        this.pendingNakarteZoomPush &&
        isStaleNakarteZoomEcho(data.location, this.pendingNakarteZoomPush)
      ) {
        return
      }

      if (this.pendingNakarteZoomPush && data.location.zoom === this.pendingNakarteZoomPush.zoom) {
        this.clearPendingNakarteZoomPush()
      }

      if (!locationsEqual(data.location, this.nakarteLocation)) {
        this.scheduleSyncFromNakarte(data.location)
      }
      return
    }

    if (data.type === 'cursor') {
      if (data.location) {
        this.updateLeftCursorFromGeo(data.location)
        return
      }

      this.hideLeftCursorMarker()
    }
  }
}
