/**
 * Управление синхронизацией координат и подписками на события в сплит-режиме Go To.
 */
import { isNakarteOrigin } from '@/lib/extension_origins'
import type { MapLocation } from '@/lib/go_to_link'
import { normalizeMapZoom } from '@/lib/go_to_map_sync'
import { calculateWheelZoomSteps, URL_POLL_INTERVAL_MS } from '@/lib/go_to_split_view/core'
import type { SplitDomElements } from '@/lib/go_to_split_view/dom'
import { NMAPS_BOUNDS_CHANGE_EVENT, parseBoundsChangeEvent } from '@/lib/nmaps_bounds_notify'
import { NMAPS_URL_CHANGE_EVENT } from '@/lib/nmaps_url_notify'
import { SplitCursorTracker } from './cursor_tracker'
import { SplitLocationCoordinator } from './location_coordinator'
import {
  NAKARTE_SYNC_MSG_SOURCE,
  readNmapsLocation,
  type SplitLocationMessage,
  wrapHistoryMethod,
} from './split_bridge'

export * from './cursor_tracker'
export * from './location_coordinator'
export * from './split_bridge'

export class SplitSyncManager {
  private urlPollTimer: ReturnType<typeof setInterval> | undefined
  private wheelZoomAccumulator = 0
  private cleanupFns: Array<() => void> = []
  private readonly cursorTracker: SplitCursorTracker
  private readonly locationCoordinator: SplitLocationCoordinator

  constructor(
    private readonly dom: SplitDomElements,
    initialLocation: MapLocation,
  ) {
    this.cursorTracker = new SplitCursorTracker(dom)
    this.locationCoordinator = new SplitLocationCoordinator(dom.iframe, initialLocation)
  }

  public initListeners(): void {
    const onNmapsUrlChange = () => this.syncNmapsLocationToNakarte()

    const restorePushState = wrapHistoryMethod('pushState', onNmapsUrlChange)
    const restoreReplaceState = wrapHistoryMethod('replaceState', onNmapsUrlChange)

    const handleMouseMove = (e: MouseEvent) =>
      this.cursorTracker.handleNmapsMouseMove(e, this.locationCoordinator.getNakarteLocation())
    const handleMouseLeave = () => this.cursorTracker.handleNmapsMouseLeave()
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
    this.locationCoordinator.postInitialLocation()
  }

  public hideCursorMarkers(): void {
    this.cursorTracker.hideCursorMarkers()
  }

  public hideLeftCursorMarker(): void {
    this.cursorTracker.hideLeftCursorMarker()
  }

  public hideRightCursorMarker(): void {
    this.cursorTracker.hideRightCursorMarker()
  }

  public pushLocationToNakarte(location: MapLocation, immediate = false): void {
    this.locationCoordinator.pushLocationToNakarte(location, immediate)
  }

  public dispose(): void {
    this.locationCoordinator.dispose()

    for (const cleanup of this.cleanupFns) cleanup()
    this.cleanupFns = []
  }

  private syncNmapsLocationToNakarte(): void {
    const location = readNmapsLocation()
    if (!location) return
    const resolved = this.locationCoordinator.resolveLocationForNakarteSync(location)
    this.locationCoordinator.pushLocationToNakarte(resolved)
  }

  private handleNmapsBoundsChange(event: Event): void {
    const location = parseBoundsChangeEvent(event)
    if (!location) return
    this.locationCoordinator.pushLocationToNakarte(location, true)
  }

  private handleNmapsWheel(event: WheelEvent): void {
    const nmapsLoc = this.locationCoordinator.getNmapsLocation()
    if (!nmapsLoc) return

    const { steps, newAccumulator } = calculateWheelZoomSteps(
      event.deltaY,
      this.wheelZoomAccumulator,
    )
    this.wheelZoomAccumulator = newAccumulator
    if (steps === 0) return

    const nextZoom = normalizeMapZoom(nmapsLoc.zoom - steps)
    if (nextZoom === nmapsLoc.zoom) return

    this.locationCoordinator.pushLocationToNakarte({ ...nmapsLoc, zoom: nextZoom }, true)
  }

  private handleWindowMessage(event: MessageEvent): void {
    const data = event.data as SplitLocationMessage | undefined
    if (!data || data.source !== NAKARTE_SYNC_MSG_SOURCE) return
    if (!isNakarteOrigin(event.origin)) return
    if (event.source !== this.dom.iframe?.contentWindow) return

    if (data.type === 'location' && data.location) {
      this.locationCoordinator.handleNakarteIncomingLocation(data.location)
      return
    }

    if (data.type === 'cursor') {
      if (data.location) {
        this.cursorTracker.updateLeftCursorFromGeo(
          data.location,
          this.locationCoordinator.getNmapsLocation(),
        )
        return
      }

      this.cursorTracker.hideLeftCursorMarker()
    }
  }
}
