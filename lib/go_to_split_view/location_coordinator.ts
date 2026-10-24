import type { MapLocation } from '@/lib/go_to_link'
import {
  buildNmapsUrlFromLocation,
  locationsEqual,
  normalizeMapLocation,
} from '@/lib/go_to_map_sync'
import {
  isStaleNakarteZoomEcho,
  NAKARTE_ZOOM_PUSH_GRACE_MS,
  SYNC_DEBOUNCE_MS,
} from '@/lib/go_to_split_view/core'
import { postLocationToIframe } from './split_bridge'

export class SplitLocationCoordinator {
  private syncTimer: ReturnType<typeof setTimeout> | undefined
  private pendingNakarteZoomPushTimer: ReturnType<typeof setTimeout> | undefined
  private lastPolledUrlLocation: MapLocation | null = null
  private lastPushedZoom: number | null = null
  private pendingNakarteZoomPush: MapLocation | null = null
  private nmapsLocation: MapLocation | null = null
  private nakarteLocation: MapLocation | null = null

  constructor(
    private readonly iframe: HTMLIFrameElement,
    initialLocation: MapLocation,
  ) {
    this.nmapsLocation = initialLocation
    this.nakarteLocation = initialLocation
    this.lastPolledUrlLocation = normalizeMapLocation(initialLocation)
    this.lastPushedZoom = normalizeMapLocation(initialLocation).zoom
  }

  public getNmapsLocation(): MapLocation | null {
    return this.nmapsLocation
  }

  public getNakarteLocation(): MapLocation | null {
    return this.nakarteLocation
  }

  public postInitialLocation(): void {
    if (this.nmapsLocation) {
      postLocationToIframe(this.iframe, this.nmapsLocation)
    }
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

      postLocationToIframe(this.iframe, normalized)
      this.nakarteLocation = normalized
    }

    clearTimeout(this.syncTimer)
    if (shouldSendImmediately) {
      send()
      return
    }

    this.syncTimer = setTimeout(send, SYNC_DEBOUNCE_MS)
  }

  public handleNakarteIncomingLocation(location: MapLocation): void {
    if (
      this.pendingNakarteZoomPush &&
      isStaleNakarteZoomEcho(location, this.pendingNakarteZoomPush)
    ) {
      return
    }

    if (this.pendingNakarteZoomPush && location.zoom === this.pendingNakarteZoomPush.zoom) {
      this.clearPendingNakarteZoomPush()
    }

    if (!locationsEqual(location, this.nakarteLocation)) {
      this.scheduleSyncFromNakarte(location)
    }
  }

  public resolveLocationForNakarteSync(urlLocation: MapLocation): MapLocation {
    const normalized = normalizeMapLocation(urlLocation)
    this.lastPolledUrlLocation = normalized
    return normalized
  }

  public dispose(): void {
    clearTimeout(this.syncTimer)
    this.syncTimer = undefined
    this.lastPushedZoom = null
    this.clearPendingNakarteZoomPush()

    this.nmapsLocation = null
    this.nakarteLocation = null
    this.lastPolledUrlLocation = null
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
}
