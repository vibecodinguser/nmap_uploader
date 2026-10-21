/**
 * Интерактивный выбор точек/полигонов на Народной карте (Overlay Click Picker).
 */
import { projectScreenClickToLatLon } from '@/lib/nmaps/projection'
import { notifyPointPicked } from '@/lib/nmaps_pick_point_notify'

export const getCoordsFromUrlClick = (
  clientX: number,
  clientY: number,
): [number, number] | null => {
  const hash = globalThis.location.hash
  const paramsStr = hash.split('?')[1]
  if (!paramsStr) return null
  const params = new URLSearchParams(paramsStr)
  const zStr = params.get('z')
  const llStr = params.get('ll')
  if (!zStr || !llStr) return null
  const z = Number.parseFloat(zStr)
  const [lon, lat] = llStr.split(',').map(Number.parseFloat)
  if (Number.isNaN(z) || Number.isNaN(lon) || Number.isNaN(lat)) return null

  let cx = globalThis.innerWidth / 2
  let cy = globalThis.innerHeight / 2

  const crosshair = document.querySelector(
    '.nk-map-crosshair, [class*="crosshair"], .ymaps-map-crosshair',
  )
  if (crosshair) {
    const rect = crosshair.getBoundingClientRect()
    cx = rect.left + rect.width / 2
    cy = rect.top + rect.height / 2
  } else {
    const mapContainer =
      document.querySelector('.nk-map') ||
      document.querySelector('.ymaps-map') ||
      document.querySelector('[class*="map"]')
    if (mapContainer) {
      const rect = mapContainer.getBoundingClientRect()
      cx = rect.left + rect.width / 2
      cy = rect.top + rect.height / 2
    }
  }

  const { lat: outLat, lon: outLon } = projectScreenClickToLatLon(
    clientX,
    clientY,
    cx,
    cy,
    lat,
    lon,
    z,
  )

  return [outLat, outLon]
}

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
    this.svg.innerHTML = ''
    if (this.accumulatedPixels.length === 0) return

    const pointsStr = this.accumulatedPixels.map((p) => `${p.x},${p.y}`).join(' ')

    if (this.geomType === 'Polygon' && this.accumulatedPixels.length > 2) {
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      polygon.setAttribute('points', pointsStr)
      polygon.setAttribute('fill', 'rgba(0, 120, 255, 0.3)')
      polygon.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
      polygon.setAttribute('stroke-width', '2')
      this.svg.appendChild(polygon)
    } else {
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
      polyline.setAttribute('points', pointsStr)
      polyline.setAttribute('fill', 'none')
      polyline.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
      polyline.setAttribute('stroke-width', '2')
      this.svg.appendChild(polyline)
    }

    for (const p of this.accumulatedPixels) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', String(p.x))
      circle.setAttribute('cy', String(p.y))
      circle.setAttribute('r', '4')
      circle.setAttribute('fill', '#ffffff')
      circle.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
      circle.setAttribute('stroke-width', '2')
      this.svg.appendChild(circle)
    }
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
