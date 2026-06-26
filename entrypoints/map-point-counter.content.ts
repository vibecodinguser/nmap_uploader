import { defineContentScript } from 'wxt/utils/define-content-script'
import { createTranslator } from '@/lib/i18n'

let t = createTranslator('ru')

const UI_WRAPPER_ID = 'nmap-point-counter-wrapper'

let counterWrapper: HTMLElement | null = null
let counterText: HTMLElement | null = null

const createCounterUi = () => {
  if (document.getElementById(UI_WRAPPER_ID)) return

  counterWrapper = document.createElement('div')
  counterWrapper.id = UI_WRAPPER_ID
  counterWrapper.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.5);
    color: var(--map-region__path--font-color, #fff);
    padding: 0 16px;
    border-radius: 19px;
    line-height: 38px;
    white-space: nowrap;
    font-family: "YS Text", Arial, sans-serif;
    font-size: 13px;
    z-index: 9999;
    pointer-events: none;
    display: none;
    opacity: 0;
    box-shadow: 0 3px 0 0 rgba(0, 0, 0, 0.05);
    transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out, color 0.2s ease-in-out;
  `

  counterText = document.createElement('span')
  counterText.textContent = t('mapPointCounter.points', { count: 0 })
  counterWrapper.appendChild(counterText)

  document.body.appendChild(counterWrapper)
}

const isBuildingCategory = (): boolean => {
  // 1. Ищем выбранную категорию по активному классу в интерфейсе
  const activeElements = Array.from(
    document.querySelectorAll(
      '[class*="active"], [class*="selected"], [class*="checked"], [aria-selected="true"]',
    ),
  )

  for (const el of activeElements) {
    const text = el.textContent?.trim().toLowerCase() || ''
    // Если текст активного элемента (например, выбранной кнопки) содержит "здание"
    if (text.length < 50 && /(^|[^а-яё])здани/i.test(text)) {
      return true
    }
  }

  // 2. Также проверяем заголовок страницы (иногда в title пишется категория)
  if (/(^|[^а-яё])здани/i.test(document.title.toLowerCase())) {
    return true
  }

  return false
}

const showCounter = (count: number) => {
  if (!counterWrapper || !counterText) return

  // Для зданий счётчик выводить не нужно
  if (isBuildingCategory()) {
    hideCounter()
    return
  }

  const limit = 500
  const remaining = limit - count

  counterText.textContent = t('mapPointCounter.pointsLeft', { count: remaining })

  // Меняем цвет плашки в зависимости от количества оставшихся точек
  if (remaining <= 50) {
    counterWrapper.style.backgroundColor = 'rgba(255, 50, 50, 0.95)' // Красный
    counterText.style.color = 'white'
  } else if (remaining <= 100) {
    counterWrapper.style.backgroundColor = 'rgba(255, 165, 0, 0.95)' // Оранжевый
    counterText.style.color = 'black'
  } else {
    counterWrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.5)' // Полупрозрачный черный
    counterText.style.color = '#fff'
  }

  if (counterWrapper.style.display === 'none') {
    counterWrapper.style.display = 'block'
    counterWrapper.style.opacity = '1'
  }
}

const hideCounter = () => {
  if (!counterWrapper) return
  counterWrapper.style.display = 'none'
}

const countPointsInPath = (d: string): number => {
  // Ищем все числа (координаты)
  const numbers = d.match(/-?\d+(\.\d+)?/g)
  if (!numbers) return 0
  // Две координаты = одна точка
  return Math.floor(numbers.length / 2)
}

const countPointsInPolyline = (pointsAttr: string): number => {
  const numbers = pointsAttr.match(/-?\d+(\.\d+)?/g)
  if (!numbers) return 0
  return Math.floor(numbers.length / 2)
}

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',
  world: 'MAIN',

  async main() {
    // In MAIN world, browser.storage is unavailable.
    // Use HTML lang attribute as a fallback to detect language.
    const pageLang = document.documentElement.lang || navigator.language || 'ru'
    const locale = pageLang.toLowerCase().startsWith('en') ? 'en' : 'ru'
    t = createTranslator(locale as 'ru' | 'en')

    createCounterUi()

    let lastMapInteractionTime = Date.now()

    document.addEventListener(
      'pointerdown',
      (e) => {
        const target = e.target as HTMLElement | null
        // Если клик был по самой карте или canvas
        if (
          target &&
          (target.closest('ymaps') ||
            target.tagName.toLowerCase() === 'canvas' ||
            target.tagName.toLowerCase() === 'svg')
        ) {
          lastMapInteractionTime = Date.now()
        }
      },
      true, // capture phase
    )

    const candidatePaths = new Map<Element, number>()
    let activePath: Element | null = null

    const processElementAdded = (el: Element) => {
      // Игнорируем рендеры, если пользователь давно не взаимодействовал с картой (программная отрисовка трека)
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

      if (points >= 0 && points <= 3) {
        candidatePaths.set(el, points)
      }
    }

    const processElementRemoved = (el: Element) => {
      if (candidatePaths.has(el)) {
        candidatePaths.delete(el)
      }
      if (activePath === el) {
        activePath = null
        hideCounter()
      }
    }

    const processNodeList = (nodes: NodeList, isAdded: boolean) => {
      nodes.forEach((node) => {
        if (node instanceof Element) {
          const tag = node.tagName.toLowerCase()
          if (tag === 'path' || tag === 'polyline' || tag === 'polygon') {
            isAdded ? processElementAdded(node) : processElementRemoved(node)
          }
          if (isAdded) {
            const svgElements = node.querySelectorAll('path, polyline, polygon')
            svgElements.forEach(processElementAdded)
          } else {
            const svgElements = node.querySelectorAll('path, polyline, polygon')
            svgElements.forEach(processElementRemoved)
          }
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

              if (!isCandidate && points <= 3) {
                candidatePaths.set(el, points)
                if (points > 0) {
                  activePath = el
                  showCounter(points)
                }
              } else if (isCandidate) {
                // Если количество точек подскочило больше чем на 2 за раз, это не ручное рисование, а рендер готового трека
                if (points - prevPoints > 2) {
                  candidatePaths.delete(el)
                  if (activePath === el) {
                    activePath = null
                    hideCounter()
                  }
                  return
                }

                candidatePaths.set(el, points)

                if (points !== prevPoints || activePath === el) {
                  activePath = el
                  showCounter(points)
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

    const resetCounter = (_reason: string) => {
      hideCounter()
      candidatePaths.clear()
      activePath = null
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        resetCounter(t('mapPointCounter.keyPressed', { key: e.key }))
      }
    })

    document.addEventListener('dblclick', () => {
      resetCounter(t('mapPointCounter.doubleClick'))
    })

    // Скрываем счетчик при клике по боковой панели или кнопкам интерфейса (например, "Сохранить")
    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement
      if (!target) return

      const isSidebar = target.closest('.nk-sidebar-view')
      const isButton = target.closest('button') || target.closest('.nk-button')
      const text = target.textContent?.toLowerCase() || ''
      const isSaveAction =
        text.includes('сохранить') || text.includes('отменить') || text.includes('готово')

      if (isSidebar || isButton || isSaveAction) {
        resetCounter('Клик по UI (Сохранение/Отмена/Сайдбар)')
      }
    })

    if (typeof CanvasRenderingContext2D !== 'undefined') {
      const proto = CanvasRenderingContext2D.prototype
      const marker = '__nmapCounterPatched__'
      if (!(proto as any)[marker]) {
        ;(proto as any)[marker] = true

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

        proto.beginPath = function (this: CanvasRenderingContext2D, ...args: any[]) {
          currentPoints = 0
          return originalBeginPath.apply(this, args as any)
        }

        proto.moveTo = function (this: CanvasRenderingContext2D, ...args: any[]) {
          if (currentPoints === 0) currentPoints = 1
          return originalMoveTo.apply(this, args as any)
        }

        proto.lineTo = function (this: CanvasRenderingContext2D, ...args: any[]) {
          currentPoints++
          return originalLineTo.apply(this, args as any)
        }

        proto.stroke = function (this: CanvasRenderingContext2D, ...args: any[]) {
          if (Date.now() - lastMapInteractionTime > 5000) {
            return originalStroke.apply(this, args as any)
          }

          const strokeStyle = this.strokeStyle

          if (currentPoints > 0) {
            const isMagenta =
              typeof strokeStyle === 'string' &&
              (strokeStyle.toLowerCase() === '#ff00ff' ||
                strokeStyle.toLowerCase() === '#f0f' ||
                strokeStyle.toLowerCase() === 'magenta' ||
                strokeStyle.toLowerCase() === '#ffff00' ||
                strokeStyle.toLowerCase() === '#ff0' ||
                strokeStyle.toLowerCase() === 'yellow' ||
                strokeStyle.startsWith('rgba(255, 0, 255') ||
                strokeStyle.startsWith('rgba(255, 255, 0') ||
                strokeStyle.startsWith('rgba(80, 227, 194'))

            if (isMagenta) {
              if (currentPoints > maxPointsForColor) {
                maxPointsForColor = currentPoints
              }

              if (!resetTimeout) {
                resetTimeout = window.setTimeout(() => {
                  if (maxPointsForColor >= 1 && maxPointsForColor !== canvasLastShownPoints) {
                    const isJumpFromZero = canvasLastShownPoints === 0 && maxPointsForColor > 5
                    const isBigJump =
                      canvasLastShownPoints > 0 && maxPointsForColor - canvasLastShownPoints > 2

                    if (isJumpFromZero || isBigJump) {
                      // Это программный рендер трека (например, при выборе даты), игнорируем
                      hideCounter()
                      canvasLastShownPoints = 0
                    } else if (maxPointsForColor === 2 && canvasLastShownPoints > 2) {
                      // Игнорируем скачок вниз до 2
                    } else {
                      showCounter(maxPointsForColor)
                      canvasLastShownPoints = maxPointsForColor
                    }
                  }
                  maxPointsForColor = 0
                  resetTimeout = null
                }, 50)
              }
            }
          }

          return originalStroke.apply(this, args as any)
        }
      }
    }
  },
})
