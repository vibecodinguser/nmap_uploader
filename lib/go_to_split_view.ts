import { latLngToPanelPixel, mouseToLatLng } from '@/lib/go_to_geo_projection'
import { getMapLocationFromUrl, type MapLocation } from '@/lib/go_to_link'
import {
  buildNakarteUrl,
  buildNmapsUrlFromLocation,
  locationsEqual,
  NAKARTE_SYNC_MSG_SOURCE,
  NMAP_UPLOADER_MSG_SOURCE,
  normalizeMapLocation,
  normalizeMapZoom,
  type SplitLocationMessage,
} from '@/lib/go_to_map_sync'
import { GO_TO_SPLIT_BUTTON_ID } from '@/lib/go_to_split_button'
import { GO_TO_SPLIT_ACTIVE_CLASS, GO_TO_SPLIT_BUTTON_ACTIVE_CLASS } from '@/lib/go_to_styles'
import { NMAPS_BOUNDS_CHANGE_EVENT, parseBoundsChangeEvent } from '@/lib/nmaps_bounds_notify'
import { NMAPS_URL_CHANGE_EVENT } from '@/lib/nmaps_url_notify'
import { requestClosePanelSidebar } from '@/lib/panel_sidebar_notify'

const SPLIT_ROOT_ID = 'nmapUploaderSplit'
const LEFT_CURSOR_OVERLAY_CLASS = 'nmap-uploader-split__left-cursor-overlay'
const RIGHT_CURSOR_OVERLAY_CLASS = 'nmap-uploader-split__cursor-overlay'
const CURSOR_MARKER_CLASS = 'nmap-uploader-split__cursor-marker'
const CURSOR_MARKER_VISIBLE_CLASS = 'nmap-uploader-split__cursor-marker--visible'
const CURSOR_MARKER_REMOTE_CLASS = 'nmap-uploader-split__cursor-marker--remote'

const SYNC_DEBOUNCE_MS = 40
const URL_POLL_INTERVAL_MS = 120
const WHEEL_ZOOM_STEP_THRESHOLD = 50
const NAKARTE_ZOOM_PUSH_GRACE_MS = 450
const STALE_ZOOM_CENTER_EPSILON = 1e-4
const SPLIT_RESIZED_ATTR = 'data-nmap-uploader-split-resized'
const CURSOR_MARKER_RADIUS = 8

const NAK_ROOT_SELECTORS = ['.nk-app-view', '.nk-layout-view', '.nk-map-editor-view'] as const

type ResizedElementStyle = {
  element: HTMLElement
  width: string
  maxWidth: string
}

let isOpen = false
let splitRoot: HTMLElement | null = null
let iframe: HTMLIFrameElement | null = null
let leftCursorMarker: HTMLElement | null = null
let rightCursorMarker: HTMLElement | null = null
let syncTimer: ReturnType<typeof setTimeout> | undefined
let urlPollTimer: ReturnType<typeof setInterval> | undefined
let wheelZoomAccumulator = 0
let lastPolledUrlLocation: MapLocation | null = null
let lastPushedZoom: number | null = null
let pendingNakarteZoomPush: MapLocation | null = null
let pendingNakarteZoomPushTimer: ReturnType<typeof setTimeout> | undefined
let nmapsLocation: MapLocation | null = null
let nakarteLocation: MapLocation | null = null
let cleanupFns: Array<() => void> = []
let resizedElements: ResizedElementStyle[] = []
let savedHtmlOverflow = ''
let savedBodyOverflow = ''

const getSplitButton = (): HTMLButtonElement | null =>
  document.getElementById(GO_TO_SPLIT_BUTTON_ID) as HTMLButtonElement | null

const updateSplitButtonState = (): void => {
  const button = getSplitButton()
  if (!button) return

  button.classList.toggle(GO_TO_SPLIT_BUTTON_ACTIVE_CLASS, isOpen)
  button.setAttribute('aria-pressed', String(isOpen))
}

const getSplitPanelSize = (): { width: number; height: number } => ({
  width: Math.max(1, Math.round(window.innerWidth / 2)),
  height: Math.max(1, window.innerHeight),
})

const getLeftPanelSize = (): { width: number; height: number } => getSplitPanelSize()

const getRightPanelSize = (): { width: number; height: number } => getSplitPanelSize()

const hideLeftCursorMarker = (): void => {
  setMarkerPosition(leftCursorMarker, null, getLeftPanelSize())
}

const hideRightCursorMarker = (): void => {
  setMarkerPosition(rightCursorMarker, null, getRightPanelSize())
}

const hideCursorMarkers = (): void => {
  hideLeftCursorMarker()
  hideRightCursorMarker()
}

const clampMarkerPosition = (
  position: { x: number; y: number },
  panel: { width: number; height: number },
): { x: number; y: number } | null => {
  const { x, y } = position
  const { width, height } = panel

  if (x < 0 || x > width || y < 0 || y > height) return null

  const radius = CURSOR_MARKER_RADIUS
  return {
    x: Math.min(Math.max(x, radius), width - radius),
    y: Math.min(Math.max(y, radius), height - radius),
  }
}

const setMarkerPosition = (
  marker: HTMLElement | null,
  position: { x: number; y: number } | null,
  panel: { width: number; height: number },
): void => {
  if (!marker) return

  if (!position) {
    marker.classList.remove(CURSOR_MARKER_VISIBLE_CLASS)
    marker.style.left = ''
    marker.style.top = ''
    return
  }

  const clamped = clampMarkerPosition(position, panel)
  if (!clamped) {
    marker.classList.remove(CURSOR_MARKER_VISIBLE_CLASS)
    marker.style.left = ''
    marker.style.top = ''
    return
  }

  marker.style.left = `${clamped.x}px`
  marker.style.top = `${clamped.y}px`
  marker.classList.add(CURSOR_MARKER_VISIBLE_CLASS)
}

const updateRightCursorFromGeo = (location: MapLocation | null): void => {
  const panel = getRightPanelSize()
  if (!location || !nakarteLocation) {
    setMarkerPosition(rightCursorMarker, null, panel)
    return
  }

  const pixel = latLngToPanelPixel(location, nakarteLocation, panel)
  setMarkerPosition(rightCursorMarker, pixel, panel)
}

const updateLeftCursorFromGeo = (location: MapLocation | null): void => {
  const panel = getLeftPanelSize()
  if (!location || !nmapsLocation) {
    setMarkerPosition(leftCursorMarker, null, panel)
    return
  }

  const pixel = latLngToPanelPixel(location, nmapsLocation, panel)
  setMarkerPosition(leftCursorMarker, pixel, panel)
}

const postLocationToIframe = (location: MapLocation): void => {
  const normalized = normalizeMapLocation(location)
  iframe?.contentWindow?.postMessage(
    {
      source: NMAP_UPLOADER_MSG_SOURCE,
      type: 'set_location',
      location: normalized,
    },
    '*',
  )
}

const updateNmapsUrl = (location: MapLocation): void => {
  const nextHref = buildNmapsUrlFromLocation(location, window.location.href)
  if (nextHref === window.location.href) return
  history.replaceState(history.state, '', nextHref)
  nmapsLocation = location
}

const markPendingNakarteZoomPush = (location: MapLocation): void => {
  pendingNakarteZoomPush = normalizeMapLocation(location)
  clearTimeout(pendingNakarteZoomPushTimer)
  pendingNakarteZoomPushTimer = setTimeout(() => {
    pendingNakarteZoomPush = null
    pendingNakarteZoomPushTimer = undefined
  }, NAKARTE_ZOOM_PUSH_GRACE_MS)
}

const clearPendingNakarteZoomPush = (): void => {
  pendingNakarteZoomPush = null
  clearTimeout(pendingNakarteZoomPushTimer)
  pendingNakarteZoomPushTimer = undefined
}

const isStaleNakarteZoomEcho = (incoming: MapLocation, pending: MapLocation): boolean => {
  if (incoming.zoom === pending.zoom) return false

  return (
    Math.abs(incoming.latitude - pending.latitude) < STALE_ZOOM_CENTER_EPSILON &&
    Math.abs(incoming.longitude - pending.longitude) < STALE_ZOOM_CENTER_EPSILON
  )
}

const pushLocationToNakarte = (location: MapLocation, immediate = false): void => {
  const normalized = normalizeMapLocation(location)
  if (locationsEqual(normalized, nakarteLocation)) return

  nmapsLocation = normalized

  const isPanOnlyChange =
    nakarteLocation !== null &&
    normalized.zoom === nakarteLocation.zoom &&
    !locationsEqual(normalized, nakarteLocation)
  const shouldSendImmediately = immediate || isPanOnlyChange

  const send = (): void => {
    const zoomChanged = lastPushedZoom !== null && lastPushedZoom !== normalized.zoom
    lastPushedZoom = normalized.zoom

    if (zoomChanged) {
      markPendingNakarteZoomPush(normalized)
    }

    postLocationToIframe(normalized)
    nakarteLocation = normalized
  }

  clearTimeout(syncTimer)
  if (shouldSendImmediately) {
    send()
    return
  }

  syncTimer = setTimeout(send, SYNC_DEBOUNCE_MS)
}

const scheduleSyncFromNmaps = (location: MapLocation, immediate = false): void => {
  pushLocationToNakarte(location, immediate)
}

const scheduleSyncFromNakarte = (location: MapLocation): void => {
  const normalized = normalizeMapLocation(location)
  if (locationsEqual(normalized, nmapsLocation)) return

  nakarteLocation = normalized
  clearTimeout(syncTimer)

  const applyToNmaps = (): void => {
    updateNmapsUrl(normalized)
    nmapsLocation = normalized
  }

  const isPanOnlyChange = nmapsLocation !== null && normalized.zoom === nmapsLocation.zoom

  if (isPanOnlyChange) {
    applyToNmaps()
    return
  }

  syncTimer = setTimeout(applyToNmaps, SYNC_DEBOUNCE_MS)
}

const readNmapsLocation = (): MapLocation | null => getMapLocationFromUrl(window.location.href)

const resolveLocationForNakarteSync = (urlLocation: MapLocation): MapLocation => {
  const normalized = normalizeMapLocation(urlLocation)
  const urlZoomChanged =
    lastPolledUrlLocation !== null && lastPolledUrlLocation.zoom !== normalized.zoom
  lastPolledUrlLocation = normalized

  if (!nmapsLocation || normalized.zoom === nmapsLocation.zoom) {
    return normalized
  }

  if (urlZoomChanged) {
    return normalized
  }

  return { ...normalized, zoom: nmapsLocation.zoom }
}

const syncNmapsLocationToNakarte = (): void => {
  const location = readNmapsLocation()
  if (!location) return
  scheduleSyncFromNmaps(resolveLocationForNakarteSync(location))
}

const onNmapsUrlChange = (): void => {
  syncNmapsLocationToNakarte()
}

/** Обработчик реалтайм-событий ymaps boundschange из MAIN world. */
const handleNmapsBoundsChange = (event: Event): void => {
  if (!isOpen) return

  const location = parseBoundsChangeEvent(event)
  if (!location) return

  // Обновляем внутреннее состояние и синхронизируем с Nakarte немедленно
  pushLocationToNakarte(location, true)
}

const handleNmapsWheel = (event: WheelEvent): void => {
  if (!isOpen || !nmapsLocation) return

  wheelZoomAccumulator += event.deltaY
  if (Math.abs(wheelZoomAccumulator) < WHEEL_ZOOM_STEP_THRESHOLD) return

  const steps = Math.trunc(wheelZoomAccumulator / WHEEL_ZOOM_STEP_THRESHOLD)
  wheelZoomAccumulator -= steps * WHEEL_ZOOM_STEP_THRESHOLD

  const nextZoom = normalizeMapZoom(nmapsLocation.zoom - steps)
  if (nextZoom === nmapsLocation.zoom) return

  pushLocationToNakarte({ ...nmapsLocation, zoom: nextZoom }, true)
}

const wrapHistoryMethod = (
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

const handleNmapsMouseMove = (event: MouseEvent): void => {
  const view = readNmapsLocation()
  if (!view) return

  const panel = getLeftPanelSize()
  const { clientX, clientY } = event
  if (clientX < 0 || clientX > panel.width || clientY < 0 || clientY > panel.height) {
    hideRightCursorMarker()
    return
  }

  const cursor = mouseToLatLng(clientX, clientY, view, panel)
  updateRightCursorFromGeo(cursor)
}

const handleNmapsMouseLeave = (): void => {
  hideRightCursorMarker()
}

const handleWindowMessage = (event: MessageEvent): void => {
  if (!isOpen) return

  const data = event.data as SplitLocationMessage | undefined
  if (!data || data.source !== NAKARTE_SYNC_MSG_SOURCE) return
  if (event.source !== iframe?.contentWindow) return

  if (data.type === 'location' && data.location) {
    if (pendingNakarteZoomPush && isStaleNakarteZoomEcho(data.location, pendingNakarteZoomPush)) {
      return
    }

    if (pendingNakarteZoomPush && data.location.zoom === pendingNakarteZoomPush.zoom) {
      clearPendingNakarteZoomPush()
    }

    if (!locationsEqual(data.location, nakarteLocation)) {
      scheduleSyncFromNakarte(data.location)
    }
    return
  }

  if (data.type === 'cursor') {
    if (data.location) {
      updateLeftCursorFromGeo(data.location)
      return
    }

    hideLeftCursorMarker()
  }
}

const applyNakRootResize = (): void => {
  for (const selector of NAK_ROOT_SELECTORS) {
    const element = document.querySelector(selector)
    if (!(element instanceof HTMLElement)) continue
    if (element.hasAttribute(SPLIT_RESIZED_ATTR)) continue

    resizedElements.push({
      element,
      width: element.style.width,
      maxWidth: element.style.maxWidth,
    })
    element.style.width = '50vw'
    element.style.maxWidth = '50vw'
    element.setAttribute(SPLIT_RESIZED_ATTR, 'true')
  }
}

const clearNakRootResize = (): void => {
  for (const { element, width, maxWidth } of resizedElements) {
    element.style.width = width
    element.style.maxWidth = maxWidth
    element.removeAttribute(SPLIT_RESIZED_ATTR)
  }
  resizedElements = []
}

const applySplitLayout = (): void => {
  savedHtmlOverflow = document.documentElement.style.overflow
  savedBodyOverflow = document.body.style.overflow
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.documentElement.classList.add(GO_TO_SPLIT_ACTIVE_CLASS)
  applyNakRootResize()
}

const clearSplitLayout = (): void => {
  document.documentElement.classList.remove(GO_TO_SPLIT_ACTIVE_CLASS)
  document.documentElement.style.overflow = savedHtmlOverflow
  document.body.style.overflow = savedBodyOverflow
  savedHtmlOverflow = ''
  savedBodyOverflow = ''
  clearNakRootResize()
}

const createCursorOverlay = (className: string, isRemote: boolean): HTMLElement => {
  const overlay = document.createElement('div')
  overlay.className = className

  const marker = document.createElement('div')
  marker.className = CURSOR_MARKER_CLASS
  if (isRemote) marker.classList.add(CURSOR_MARKER_REMOTE_CLASS)
  overlay.appendChild(marker)

  return overlay
}

const mountSplitDom = (nakarteUrl: string): void => {
  const root = document.createElement('div')
  root.id = SPLIT_ROOT_ID
  root.className = 'nmap-uploader-split'

  const iframeWrap = document.createElement('div')
  iframeWrap.className = 'nmap-uploader-split__iframe-wrap'

  const frame = document.createElement('iframe')
  frame.className = 'nmap-uploader-split__iframe'
  frame.src = nakarteUrl
  frame.title = 'Nakarte'
  frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
  frame.addEventListener('load', () => {
    if (nmapsLocation) postLocationToIframe(nmapsLocation)
  })

  iframeWrap.appendChild(frame)

  const rightOverlay = createCursorOverlay(RIGHT_CURSOR_OVERLAY_CLASS, false)
  rightCursorMarker = rightOverlay.firstElementChild as HTMLElement

  const leftOverlay = createCursorOverlay(LEFT_CURSOR_OVERLAY_CLASS, true)
  leftCursorMarker = leftOverlay.firstElementChild as HTMLElement

  root.appendChild(iframeWrap)
  root.appendChild(rightOverlay)
  document.body.appendChild(root)
  document.body.appendChild(leftOverlay)

  splitRoot = root
  iframe = frame
}

const mountSplitView = (): boolean => {
  const location = readNmapsLocation()
  if (!location) return false

  requestClosePanelSidebar()

  nmapsLocation = location
  nakarteLocation = location
  lastPolledUrlLocation = normalizeMapLocation(location)
  lastPushedZoom = normalizeMapLocation(location).zoom

  applySplitLayout()
  mountSplitDom(buildNakarteUrl(location))
  requestAnimationFrame(() => {
    hideCursorMarkers()
  })

  const restorePushState = wrapHistoryMethod('pushState', onNmapsUrlChange)
  const restoreReplaceState = wrapHistoryMethod('replaceState', onNmapsUrlChange)

  window.addEventListener('popstate', onNmapsUrlChange)
  window.addEventListener('hashchange', onNmapsUrlChange)
  document.addEventListener(NMAPS_URL_CHANGE_EVENT, onNmapsUrlChange)
  window.addEventListener('mousemove', handleNmapsMouseMove)
  window.addEventListener('mouseleave', handleNmapsMouseLeave)
  window.addEventListener('message', handleWindowMessage)
  window.addEventListener('wheel', handleNmapsWheel, { passive: true, capture: true })
  document.addEventListener(NMAPS_BOUNDS_CHANGE_EVENT, handleNmapsBoundsChange)

  urlPollTimer = setInterval(syncNmapsLocationToNakarte, URL_POLL_INTERVAL_MS)

  cleanupFns = [
    restorePushState,
    restoreReplaceState,
    () => window.removeEventListener('popstate', onNmapsUrlChange),
    () => window.removeEventListener('hashchange', onNmapsUrlChange),
    () => document.removeEventListener(NMAPS_URL_CHANGE_EVENT, onNmapsUrlChange),
    () => window.removeEventListener('mousemove', handleNmapsMouseMove),
    () => window.removeEventListener('mouseleave', handleNmapsMouseLeave),
    () => window.removeEventListener('message', handleWindowMessage),
    () => window.removeEventListener('wheel', handleNmapsWheel, true),
    () => document.removeEventListener(NMAPS_BOUNDS_CHANGE_EVENT, handleNmapsBoundsChange),
    () => {
      if (!urlPollTimer) return
      clearInterval(urlPollTimer)
      urlPollTimer = undefined
    },
    () => {
      wheelZoomAccumulator = 0
    },
  ]

  isOpen = true
  updateSplitButtonState()
  return true
}

export const isSplitViewOpen = (): boolean => isOpen

export const teardownSplitView = (): void => {
  if (!isOpen) return

  clearTimeout(syncTimer)
  syncTimer = undefined
  lastPushedZoom = null
  clearPendingNakarteZoomPush()

  for (const cleanup of cleanupFns) cleanup()
  cleanupFns = []

  splitRoot?.remove()
  document.querySelector(`.${LEFT_CURSOR_OVERLAY_CLASS}`)?.remove()

  splitRoot = null
  iframe = null
  leftCursorMarker = null
  rightCursorMarker = null
  nmapsLocation = null
  nakarteLocation = null
  lastPolledUrlLocation = null

  clearSplitLayout()
  isOpen = false
  updateSplitButtonState()
}

export const toggleSplitView = (): boolean => {
  if (isOpen) {
    teardownSplitView()
    return true
  }

  return mountSplitView()
}
