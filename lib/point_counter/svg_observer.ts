import {
  countPointsInPath,
  countPointsInPolyline,
  MAP_INTERACTION_TIMEOUT_MS,
  MAX_OBSERVED_POINTS,
  normalizeActiveDrawingPoints,
} from './core'
import type { PointCounterUi } from './dom_ui'
import { attachCounterResetListeners } from './svg_reset_listeners'
import {
  getThrottledSystemRemainingVertices,
  resetSystemRemainingCache,
  setSystemBannerSuppressed,
} from './system_banner'

export * from './svg_reset_listeners'

/**
 * Проверяет, принадлежит ли SVG-элемент области рисования геометрии на карте,
 * а не интерфейсным элементам (иконкам кнопок тулбара, сайдбара и т.д.).
 */
export const isMapDrawingSvgElement = (el: Element | null): boolean => {
  if (!el || typeof el.closest !== 'function') return false

  if (
    el.closest(
      'button, .nk-button, [role="button"], [class*="toolbar"], [class*="sidebar"], [class*="icon"], [class*="menu"], [class*="popup"], [class*="dropdown"], [class*="header"], [class*="user"], [class*="control"], #nmap-point-counter-wrapper',
    )
  ) {
    return false
  }

  const hasMapContainer =
    typeof document !== 'undefined' &&
    Boolean(document.querySelector('ymaps, [class*="map"], .nk-map'))

  if (hasMapContainer) {
    return Boolean(
      el.closest('ymaps') ||
        el.closest('[class*="map"]') ||
        el.closest('.nk-map') ||
        el.ownerSVGElement?.closest('ymaps') ||
        el.ownerSVGElement?.closest('[class*="map"]'),
    )
  }

  return true
}

export interface SvgCounterObserverOptions {
  ui: PointCounterUi
  getLastMapInteractionTime: () => number
  isCounterEnabled?: () => boolean
}

export class SvgPointCounterObserver {
  private candidatePaths = new Map<Element, number>()
  private activePath: Element | null = null
  private observer: MutationObserver | null = null
  private hasShownSystemStatus = false
  private readonly ui: PointCounterUi
  private readonly getLastMapInteractionTime: () => number
  private readonly isCounterEnabled?: () => boolean

  constructor({ ui, getLastMapInteractionTime, isCounterEnabled }: SvgCounterObserverOptions) {
    this.ui = ui
    this.getLastMapInteractionTime = getLastMapInteractionTime
    this.isCounterEnabled = isCounterEnabled
  }

  public start(): () => void {
    if (typeof document === 'undefined') return () => {}

    const shouldSuppress = this.isCounterEnabled ? this.isCounterEnabled() : true
    if (shouldSuppress) {
      setSystemBannerSuppressed(true)
    }

    this.observer = new MutationObserver((mutations) => {
      let hasExternalMutations = false
      for (const mutation of mutations) {
        if (
          mutation.target instanceof Element &&
          (mutation.target.id === 'nmap-point-counter-wrapper' ||
            mutation.target.closest('#nmap-point-counter-wrapper'))
        ) {
          continue
        }
        hasExternalMutations = true
        break
      }
      if (!hasExternalMutations) return

      if (this.checkSystemBanner(true)) return

      for (const mutation of mutations) {
        if (
          mutation.target instanceof Element &&
          (mutation.target.id === 'nmap-point-counter-wrapper' ||
            mutation.target.closest('#nmap-point-counter-wrapper'))
        ) {
          continue
        }

        if (mutation.type === 'childList') {
          if (mutation.addedNodes.length > 0) this.processNodeList(mutation.addedNodes, true)
          if (mutation.removedNodes.length > 0) this.processNodeList(mutation.removedNodes, false)
        } else if (mutation.type === 'attributes') {
          this.processAttributeChange(mutation.target as Element)
        }
      }
    })

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['d', 'points'],
    })

    this.checkSystemBanner(true)

    const removeResetListeners = attachCounterResetListeners(this.resetCounter)

    return () => {
      this.stop()
      removeResetListeners()
    }
  }

  public checkSystemBanner(force = false): boolean {
    const shouldHide = this.isCounterEnabled ? this.isCounterEnabled() : true
    const remaining = getThrottledSystemRemainingVertices(undefined, force, shouldHide)
    if (remaining !== null) {
      this.hasShownSystemStatus = true
      this.ui.showRemaining(remaining)
      return true
    }

    if (this.hasShownSystemStatus) {
      this.hasShownSystemStatus = false
      if (this.activePath && this.candidatePaths.has(this.activePath)) {
        const points = this.candidatePaths.get(this.activePath) || 0
        if (points > 0 && points <= MAX_OBSERVED_POINTS) {
          this.ui.show(normalizeActiveDrawingPoints(points))
          return false
        }
      }
      this.ui.hide()
    }

    return false
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.resetCounter()
    setSystemBannerSuppressed(false)
  }

  public resetCounter = (): void => {
    resetSystemRemainingCache()
    this.hasShownSystemStatus = false
    this.ui.hide()
    this.candidatePaths.clear()
    this.activePath = null
  }

  private processElementAdded(el: Element): void {
    if (!isMapDrawingSvgElement(el)) return
    if (Date.now() - this.getLastMapInteractionTime() > MAP_INTERACTION_TIMEOUT_MS) return

    let points = -1
    const tag = el.tagName.toLowerCase()

    if (tag === 'path') {
      const d = el.getAttribute('d')
      if (d) points = countPointsInPath(d)
    } else if (tag === 'polyline' || tag === 'polygon') {
      const pts = el.getAttribute('points')
      if (pts) points = countPointsInPolyline(pts)
    }

    if (points > 0 && points <= MAX_OBSERVED_POINTS) {
      this.candidatePaths.set(el, points)
      this.activePath = el
      if (!this.checkSystemBanner()) {
        this.ui.show(normalizeActiveDrawingPoints(points))
      }
    } else if (points === 0) {
      this.candidatePaths.set(el, points)
    }
  }

  private processElementRemoved(el: Element): void {
    if (this.candidatePaths.has(el)) {
      this.candidatePaths.delete(el)
    }
    if (this.activePath === el) {
      this.activePath = null

      let bestCandidate: Element | null = null
      let maxPoints = 0
      for (const [candidate, pts] of this.candidatePaths.entries()) {
        if (pts > maxPoints) {
          maxPoints = pts
          bestCandidate = candidate
        }
      }

      if (bestCandidate && maxPoints > 0) {
        this.activePath = bestCandidate
        this.ui.show(normalizeActiveDrawingPoints(maxPoints))
        return
      }

      this.hasShownSystemStatus = false
      resetSystemRemainingCache()

      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          if (this.activePath === null) {
            this.ui.hide()
          }
        }, 100)
      } else {
        this.ui.hide()
      }
    }
  }

  private processNodeList(nodes: NodeList, isAdded: boolean): void {
    nodes.forEach((node) => {
      if (node instanceof Element) {
        if (!isMapDrawingSvgElement(node)) return

        const tag = node.tagName.toLowerCase()
        if (tag === 'path' || tag === 'polyline' || tag === 'polygon') {
          if (isAdded) {
            this.processElementAdded(node)
          } else {
            this.processElementRemoved(node)
          }
        }
        const svgElements = node.querySelectorAll('path, polyline, polygon')
        svgElements.forEach((el) => {
          if (isAdded) {
            this.processElementAdded(el)
          } else {
            this.processElementRemoved(el)
          }
        })
      }
    })
  }

  private processAttributeChange(el: Element): void {
    if (!isMapDrawingSvgElement(el)) return

    const tag = el.tagName.toLowerCase()
    if (tag !== 'path' && tag !== 'polyline' && tag !== 'polygon') return

    let points = -1
    if (tag === 'path') {
      const d = el.getAttribute('d')
      if (d) points = countPointsInPath(d)
    } else {
      const pts = el.getAttribute('points')
      if (pts) points = countPointsInPolyline(pts)
    }

    if (points < 0) return
    if (Date.now() - this.getLastMapInteractionTime() > MAP_INTERACTION_TIMEOUT_MS) return

    const isCandidate = this.candidatePaths.has(el)
    const prevPoints = isCandidate ? this.candidatePaths.get(el) || 0 : -1

    if (!isCandidate && points <= 1) {
      this.candidatePaths.set(el, points)
      if (points > 0) {
        this.activePath = el
        if (!this.checkSystemBanner()) {
          this.ui.show(normalizeActiveDrawingPoints(points))
        }
      }
    } else if (isCandidate) {
      if (points > MAX_OBSERVED_POINTS) {
        this.candidatePaths.delete(el)
        if (this.activePath === el) {
          this.activePath = null
          this.ui.hide()
        }
        return
      }

      this.candidatePaths.set(el, points)

      if (points !== prevPoints || this.activePath === el) {
        this.activePath = el
        if (!this.checkSystemBanner()) {
          this.ui.show(normalizeActiveDrawingPoints(points))
        }
      }
    } else if (!isCandidate && points <= MAX_OBSERVED_POINTS) {
      this.candidatePaths.set(el, points)
      this.activePath = el
      if (!this.checkSystemBanner()) {
        this.ui.show(normalizeActiveDrawingPoints(points))
      }
    }
  }
}
