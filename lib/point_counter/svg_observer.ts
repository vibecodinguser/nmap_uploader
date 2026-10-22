import { countPointsInPath, countPointsInPolyline } from './core'
import type { PointCounterUi } from './dom_ui'
import { attachCounterResetListeners } from './svg_reset_listeners'

export * from './svg_reset_listeners'

export interface SvgCounterObserverOptions {
  ui: PointCounterUi
  getLastMapInteractionTime: () => number
}

export class SvgPointCounterObserver {
  private candidatePaths = new Map<Element, number>()
  private activePath: Element | null = null
  private observer: MutationObserver | null = null
  private readonly ui: PointCounterUi
  private readonly getLastMapInteractionTime: () => number

  constructor({ ui, getLastMapInteractionTime }: SvgCounterObserverOptions) {
    this.ui = ui
    this.getLastMapInteractionTime = getLastMapInteractionTime
  }

  public start(): () => void {
    if (typeof document === 'undefined') return () => {}

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
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

    const removeResetListeners = attachCounterResetListeners(this.resetCounter)

    return () => {
      this.stop()
      removeResetListeners()
    }
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.resetCounter()
  }

  public resetCounter = (): void => {
    this.ui.hide()
    this.candidatePaths.clear()
    this.activePath = null
  }

  private processElementAdded(el: Element): void {
    if (Date.now() - this.getLastMapInteractionTime() > 5000) return

    let points = -1
    const tag = el.tagName.toLowerCase()

    if (tag === 'path') {
      const d = el.getAttribute('d')
      if (d) points = countPointsInPath(d)
    } else if (tag === 'polyline' || tag === 'polygon') {
      const pts = el.getAttribute('points')
      if (pts) points = countPointsInPolyline(pts)
    }

    if (points >= 0 && points <= 1) {
      this.candidatePaths.set(el, points)
    }
  }

  private processElementRemoved(el: Element): void {
    if (this.candidatePaths.has(el)) {
      this.candidatePaths.delete(el)
    }
    if (this.activePath === el) {
      this.activePath = null
      this.ui.hide()
    }
  }

  private processNodeList(nodes: NodeList, isAdded: boolean): void {
    nodes.forEach((node) => {
      if (node instanceof Element) {
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
    if (Date.now() - this.getLastMapInteractionTime() > 5000) return

    const isCandidate = this.candidatePaths.has(el)
    const prevPoints = isCandidate ? this.candidatePaths.get(el) || 0 : -1

    if (!isCandidate && points <= 1) {
      this.candidatePaths.set(el, points)
      if (points > 0) {
        this.activePath = el
        this.ui.show(points)
      }
    } else if (isCandidate) {
      if (points - prevPoints > 2) {
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
        this.ui.show(points)
      }
    }
  }
}
