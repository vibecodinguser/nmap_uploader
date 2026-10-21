/**
 * Чистая логика разметки и гео-маркеров разделенного экрана Go To (Hexagonal Architecture Core).
 */
import type { MapLocation } from '@/lib/go_to_link'

export const SPLIT_ROOT_ID = 'nmapUploaderSplit'
export const LEFT_CURSOR_OVERLAY_CLASS = 'nmap-uploader-split__left-cursor-overlay'
export const RIGHT_CURSOR_OVERLAY_CLASS = 'nmap-uploader-split__cursor-overlay'
export const CURSOR_MARKER_CLASS = 'nmap-uploader-split__cursor-marker'
export const CURSOR_MARKER_VISIBLE_CLASS = 'nmap-uploader-split__cursor-marker--visible'
export const CURSOR_MARKER_REMOTE_CLASS = 'nmap-uploader-split__cursor-marker--remote'

export const SYNC_DEBOUNCE_MS = 40
export const URL_POLL_INTERVAL_MS = 120
export const WHEEL_ZOOM_STEP_THRESHOLD = 50
export const NAKARTE_ZOOM_PUSH_GRACE_MS = 450
export const STALE_ZOOM_CENTER_EPSILON = 1e-4
export const SPLIT_RESIZED_ATTR = 'data-nmap-uploader-split-resized'
export const CURSOR_MARKER_RADIUS = 8

export const NAK_ROOT_SELECTORS = [
  '.nk-app-view',
  '.nk-layout-view',
  '.nk-map-editor-view',
] as const

export type PanelDimensions = {
  width: number
  height: number
}

export type PixelPosition = {
  x: number
  y: number
}

export type ResizedElementStyle = {
  element: HTMLElement
  width: string
  maxWidth: string
}

/**
 * Ограничивает координаты маркера курсора в пределах панели с учетом его радиуса.
 * Возвращает null, если курсор выходит за границы панели.
 */
export const clampMarkerPosition = (
  position: PixelPosition,
  panel: PanelDimensions,
  radius: number = CURSOR_MARKER_RADIUS,
): PixelPosition | null => {
  const { x, y } = position
  const { width, height } = panel

  if (x < 0 || x > width || y < 0 || y > height) return null

  return {
    x: Math.min(Math.max(x, radius), width - radius),
    y: Math.min(Math.max(y, radius), height - radius),
  }
}

/**
 * Проверяет, является ли полученный от Nakarte zoom эхом недавно отправленного зума (с задержкой).
 */
export const isStaleNakarteZoomEcho = (
  incoming: MapLocation,
  pending: MapLocation,
  epsilon: number = STALE_ZOOM_CENTER_EPSILON,
): boolean => {
  if (incoming.zoom === pending.zoom) return false

  return (
    Math.abs(incoming.latitude - pending.latitude) < epsilon &&
    Math.abs(incoming.longitude - pending.longitude) < epsilon
  )
}

/**
 * Рассчитывает количество шагов зума по дельте колеса мыши.
 */
export const calculateWheelZoomSteps = (
  deltaY: number,
  accumulator: number,
  threshold: number = WHEEL_ZOOM_STEP_THRESHOLD,
): { steps: number; newAccumulator: number } => {
  const updatedAccumulator = accumulator + deltaY
  if (Math.abs(updatedAccumulator) < threshold) {
    return { steps: 0, newAccumulator: updatedAccumulator }
  }

  const steps = Math.trunc(updatedAccumulator / threshold)
  const newAccumulator = updatedAccumulator - steps * threshold
  return { steps, newAccumulator }
}
