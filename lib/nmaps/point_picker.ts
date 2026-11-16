/**
 * Интерактивный выбор точек/полигонов на Народной карте (Overlay Click Picker).
 *
 * Два режима: клики по вершинам (точка, линия, многоугольник) и протяжка
 * (квадрат, круг). Протяжка нужна потому, что у этих фигур значимы только две
 * точки — противоположные углы и центр с радиусом.
 */
import { notifyPointPicked } from '@/lib/nmaps_pick_point_notify'
import { getCoordsFromUrlClick } from './picker_coords'
import { renderPickerSvg } from './picker_svg'

export * from './picker_coords'
export * from './picker_svg'

/** Виды, которые рисуются протяжкой от первой точки ко второй. */
const DRAG_GEOM_TYPES = new Set(['Square', 'Circle'])

/** Минимальная протяжка в пикселях: клик без движения не создаёт фигуру. */
const MIN_DRAG_PX = 4

export class PointPickerOverlay {
  private overlay: HTMLDivElement | null = null
  private svg: SVGSVGElement | null = null
  private accumulatedCoords: number[][] = []
  private accumulatedPixels: { x: number; y: number }[] = []
  private isPicking = false
  private isDragging = false
  private dragStart: { x: number; y: number } | null = null

  constructor(
    private readonly geomType: string,
    private readonly onFinish: () => void,
    private readonly getApiCoords: (event: MouseEvent) => number[] | null,
  ) {}

  /** Координаты клика в порядке [lat, lon] — так их ждёт `notifyPointPicked`. */
  private readCoords(event: MouseEvent): number[] | null {
    const apiCoords = this.getApiCoords(event)
    const urlCoords = getCoordsFromUrlClick(event.clientX, event.clientY)
    const coords = urlCoords || apiCoords

    if (!Array.isArray(coords) || coords.length !== 2) return null
    // `getCoordsFromUrlClick` отдаёт [lat, lon], API Яндекса — [lon, lat].
    return coords === urlCoords ? [coords[0], coords[1]] : [coords[1], coords[0]]
  }

  public start(): () => void {
    if (this.isPicking) return () => {}
    this.isPicking = true

    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100vw'
    overlay.style.height = '100vh'
    overlay.style.zIndex = '2147483647'
    overlay.style.cursor = 'crosshair'

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.pointerEvents = 'none'
    overlay.appendChild(svg)
    document.body.appendChild(overlay)

    this.overlay = overlay
    this.svg = svg

    if (DRAG_GEOM_TYPES.has(this.geomType)) {
      this.bindDrag(overlay)
      return () => {
        this.cleanup()
      }
    }

    const handleOverlayClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      try {
        const coords = this.readCoords(event)
        if (coords) {
          this.accumulatedCoords.push(coords)
          this.accumulatedPixels.push({ x: event.clientX, y: event.clientY })

          if (this.geomType === 'Point') {
            this.finish()
          } else {
            this.redrawSvg()
          }
        }
      } catch (error) {
        console.error('[NMap Uploader] Overlay click error:', error)
        this.cleanup()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        this.finish()
      }
    }

    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      this.finish()
    }

    overlay.addEventListener('mousedown', handleOverlayClick)
    overlay.addEventListener('dblclick', handleDblClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      this.cleanup()
    }
  }

  /**
   * Протяжка для квадрата и круга.
   *
   * Отдельный набор обработчиков, а не ветка в обработчике клика: здесь важны
   * не отдельные клики, а пара «нажали — отпустили».
   */
  private bindDrag(overlay: HTMLDivElement): void {
    const handlePointerDown = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const coords = this.readCoords(event)
      if (!coords) return

      this.isDragging = true
      this.dragStart = { x: event.clientX, y: event.clientY }
      this.accumulatedCoords = [coords]
      this.accumulatedPixels = [{ x: event.clientX, y: event.clientY }]
      this.redrawSvg()
    }

    const handlePointerMove = (event: MouseEvent) => {
      if (!this.isDragging) return
      event.preventDefault()

      const coords = this.readCoords(event)
      if (!coords) return

      this.accumulatedCoords = [this.accumulatedCoords[0], coords]
      this.accumulatedPixels = [this.accumulatedPixels[0], { x: event.clientX, y: event.clientY }]
      this.redrawSvg()
    }

    const handlePointerUp = (event: MouseEvent) => {
      if (!this.isDragging) return
      event.preventDefault()
      this.isDragging = false

      const start = this.dragStart
      const moved =
        start !== null &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >= MIN_DRAG_PX

      if (!moved) {
        // Протяжка не состоялась: выходим из режима так же, как при Esc.
        this.accumulatedCoords = []
        this.accumulatedPixels = []
        this.finish()
        return
      }

      this.finish()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return
      event.preventDefault()
      this.isDragging = false
      this.accumulatedCoords = []
      this.accumulatedPixels = []
      this.finish()
    }

    overlay.addEventListener('mousedown', handlePointerDown)
    overlay.addEventListener('mousemove', handlePointerMove)
    overlay.addEventListener('mouseup', handlePointerUp)
    overlay.addEventListener('mouseleave', handlePointerUp)
    document.addEventListener('keydown', handleKeyDown)

    // Снимаем именно те обработчики, которые навесили.
    this.dragCleanup = () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }

  private dragCleanup: (() => void) | null = null

  private redrawSvg(): void {
    if (!this.svg) return
    renderPickerSvg(this.svg, this.accumulatedPixels, this.geomType)
  }

  private finish(): void {
    if (this.geomType === 'Polygon' && this.accumulatedCoords.length > 2) {
      const first = this.accumulatedCoords[0]
      const last = this.accumulatedCoords[this.accumulatedCoords.length - 1]
      if (last && (first[0] !== last[0] || first[1] !== last[1])) {
        this.accumulatedCoords.push([...first])
      }
    }
    // Пустой набор значит «рисование прервано»: панель должна выйти из режима
    // выбора, иначе её кнопки остаются заблокированными.
    notifyPointPicked(this.accumulatedCoords, this.geomType)
    this.cleanup()
  }

  private cleanup(): void {
    this.isPicking = false
    this.isDragging = false
    this.dragStart = null
    this.dragCleanup?.()
    this.dragCleanup = null
    this.overlay?.remove()
    this.overlay = null
    this.svg = null
    this.onFinish()
  }
}
