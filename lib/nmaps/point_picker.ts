/**
 * Интерактивный выбор точек/полигонов на Народной карте (Overlay Click Picker).
 */
import { notifyPointPicked } from '@/lib/nmaps_pick_point_notify'
import { getCoordsFromUrlClick } from './picker_coords'
import { renderPickerSvg } from './picker_svg'

export * from './picker_coords'
export * from './picker_svg'

export class PointPickerOverlay {
  private overlay: HTMLDivElement | null = null
  private svg: SVGSVGElement | null = null
  private accumulatedCoords: number[][] = []
  private accumulatedPixels: { x: number; y: number }[] = []
  private isPicking = false

  constructor(
    private readonly geomType: string,
    private readonly onFinish: () => void,
    private readonly getApiCoords: (event: MouseEvent) => number[] | null,
  ) {}

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

    const handleOverlayClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      try {
        const apiCoords = this.getApiCoords(event)
        const urlCoords = getCoordsFromUrlClick(event.clientX, event.clientY)
        const coords = urlCoords || apiCoords

        if (Array.isArray(coords) && coords.length === 2) {
          if (coords === urlCoords) {
            this.accumulatedCoords.push([coords[0], coords[1]])
          } else if (coords === apiCoords) {
            this.accumulatedCoords.push([coords[1], coords[0]])
          }

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

  private redrawSvg(): void {
    if (!this.svg) return
    renderPickerSvg(this.svg, this.accumulatedPixels, this.geomType)
  }

  private finish(): void {
    if (this.accumulatedCoords.length > 0) {
      if (this.geomType === 'Polygon' && this.accumulatedCoords.length > 2) {
        const first = this.accumulatedCoords[0]
        const last = this.accumulatedCoords.at(-1)!
        if (first[0] !== last[0] || first[1] !== last[1]) {
          this.accumulatedCoords.push([...first])
        }
      }
      notifyPointPicked(this.accumulatedCoords, this.geomType)
    }
    this.cleanup()
  }

  private cleanup(): void {
    this.isPicking = false
    this.overlay?.remove()
    this.overlay = null
    this.svg = null
    this.onFinish()
  }
}
