import { defineContentScript } from 'wxt/utils/define-content-script'
import { createTranslator, type TranslateFn } from '@/lib/i18n'
import {
  countPointsInPath,
  countPointsInPolyline,
  isEditorDrawingStrokeStyle,
  PointCounterUi,
} from '@/lib/point_counter'

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',
  world: 'MAIN',

  main() {
    const pageLang = document.documentElement.lang || navigator.language || 'ru'
    const locale = pageLang.toLowerCase().startsWith('en') ? 'en' : 'ru'
    const t: TranslateFn = createTranslator(locale)

    const ui = new PointCounterUi(() => t)
    ui.ensureCreated()

    let lastMapInteractionTime = 0

    document.addEventListener(
      'pointerdown',
      (e) => {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.closest('ymaps') ||
            target.tagName.toLowerCase() === 'canvas' ||
            target.tagName.toLowerCase() === 'svg')
        ) {
          lastMapInteractionTime = Date.now()
        }
      },
      true,
    )

    const candidatePaths = new Map<Element, number>()
    let activePath: Element | null = null

    const processElementAdded = (el: Element) => {
      if (Date.now() - lastMapInteractionTime > 5000) return

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
        candidatePaths.set(el, points)
      }
    }

    const processElementRemoved = (el: Element) => {
      if (candidatePaths.has(el)) {
        candidatePaths.delete(el)
      }
      if (activePath === el) {
        activePath = null
        ui.hide()
      }
    }

    const processNodeList = (nodes: NodeList, isAdded: boolean) => {
      nodes.forEach((node) => {
        if (node instanceof Element) {
          const tag = node.tagName.toLowerCase()
          if (tag === 'path' || tag === 'polyline' || tag === 'polygon') {
            if (isAdded) {
              processElementAdded(node)
            } else {
              processElementRemoved(node)
            }
          }
          const svgElements = node.querySelectorAll('path, polyline, polygon')
          svgElements.forEach(isAdded ? processElementAdded : processElementRemoved)
        }
      })
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          if (mutation.addedNodes.length > 0) processNodeList(mutation.addedNodes, true)
          if (mutation.removedNodes.length > 0) processNodeList(mutation.removedNodes, false)
        } else if (mutation.type === 'attributes') {
          const el = mutation.target as Element
          const tag = el.tagName.toLowerCase()
          if (tag === 'path' || tag === 'polyline' || tag === 'polygon') {
            let points = -1
            if (tag === 'path') {
              const d = el.getAttribute('d')
              if (d) points = countPointsInPath(d)
            } else {
              const pts = el.getAttribute('points')
              if (pts) points = countPointsInPolyline(pts)
            }

            if (points >= 0) {
              if (Date.now() - lastMapInteractionTime > 5000) return

              const isCandidate = candidatePaths.has(el)
              const prevPoints = isCandidate ? candidatePaths.get(el) || 0 : -1

              if (!isCandidate && points <= 1) {
                candidatePaths.set(el, points)
                if (points > 0) {
                  activePath = el
                  ui.show(points)
                }
              } else if (isCandidate) {
                if (points - prevPoints > 2) {
                  candidatePaths.delete(el)
                  if (activePath === el) {
                    activePath = null
                    ui.hide()
                  }
                  return
                }

                candidatePaths.set(el, points)

                if (points !== prevPoints || activePath === el) {
                  activePath = el
                  ui.show(points)
                }
              }
            }
          }
        }
      }
    })

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['d', 'points'],
    })

    const resetCounter = () => {
      ui.hide()
      candidatePaths.clear()
      activePath = null
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        resetCounter()
      }
    })

    document.addEventListener('dblclick', () => {
      resetCounter()
    })

    window.addEventListener('message', (event) => {
      if (event.data?.action === 'RESET_POINT_COUNTER') {
        resetCounter()
        lastMapInteractionTime = 0
      }
    })

    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement
      if (!target) return

      const isSidebar = target.closest('.nk-sidebar-view')
      const isButton = target.closest('button') || target.closest('.nk-button')
      const text = target.textContent?.toLowerCase() || ''
      const isSaveAction =
        text.includes('сохранить') || text.includes('отменить') || text.includes('готово')

      if (isSidebar || isButton || isSaveAction) {
        resetCounter()
      }
    })

    if (typeof CanvasRenderingContext2D !== 'undefined') {
      const proto = CanvasRenderingContext2D.prototype
      const marker = '__nmapCounterPatched__'
      const protoRecord = proto as unknown as Record<string, boolean>
      if (!protoRecord[marker]) {
        protoRecord[marker] = true

        let currentPoints = 0
        let canvasLastShownPoints = 0
        let maxPointsForColor = 0
        let resetTimeout: number | null = null

        document.addEventListener('dblclick', () => {
          canvasLastShownPoints = 0
        })
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === 'Escape') canvasLastShownPoints = 0
        })

        const originalBeginPath = proto.beginPath
        const originalMoveTo = proto.moveTo
        const originalLineTo = proto.lineTo
        const originalStroke = proto.stroke

        proto.beginPath = function (
          this: CanvasRenderingContext2D,
          ...args: Parameters<typeof originalBeginPath>
        ) {
          currentPoints = 0
          return originalBeginPath.apply(this, args)
        }

        proto.moveTo = function (
          this: CanvasRenderingContext2D,
          ...args: Parameters<typeof originalMoveTo>
        ) {
          if (currentPoints === 0) currentPoints = 1
          return originalMoveTo.apply(this, args)
        }

        proto.lineTo = function (
          this: CanvasRenderingContext2D,
          ...args: Parameters<typeof originalLineTo>
        ) {
          currentPoints++
          return originalLineTo.apply(this, args)
        }

        proto.stroke = function (this: CanvasRenderingContext2D, ...args: [path?: Path2D]) {
          if (Date.now() - lastMapInteractionTime > 5000) {
            return (originalStroke as (...a: unknown[]) => void).apply(this, args)
          }

          const strokeStyle = this.strokeStyle

          if (currentPoints > 0 && isEditorDrawingStrokeStyle(strokeStyle)) {
            if (currentPoints > maxPointsForColor) {
              maxPointsForColor = currentPoints
            }

            if (!resetTimeout) {
              resetTimeout = window.setTimeout(() => {
                if (maxPointsForColor >= 1 && maxPointsForColor !== canvasLastShownPoints) {
                  const isJumpFromZero = canvasLastShownPoints === 0 && maxPointsForColor > 1
                  const isBigJump =
                    canvasLastShownPoints > 0 && maxPointsForColor - canvasLastShownPoints > 2

                  if (isJumpFromZero || isBigJump) {
                    ui.hide()
                    canvasLastShownPoints = 0
                  } else if (maxPointsForColor === 2 && canvasLastShownPoints > 2) {
                    // Игнорируем скачок вниз до 2
                  } else {
                    ui.show(maxPointsForColor)
                    canvasLastShownPoints = maxPointsForColor
                  }
                }
                maxPointsForColor = 0
                resetTimeout = null
              }, 50)
            }
          }

          return (originalStroke as (...a: unknown[]) => void).apply(this, args)
        }
      }
    }
  },
})
