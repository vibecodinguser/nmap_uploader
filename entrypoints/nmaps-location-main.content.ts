import { defineContentScript } from 'wxt/utils/define-content-script'
import { notifyNmapsBoundsChange } from '@/lib/nmaps_bounds_notify'
import { NMAPS_MAP_RESIZE_EVENT } from '@/lib/nmaps_map_resize_notify'
import {
  NMAPS_START_PICK_POINT_EVENT,
  notifyPointPicked,
} from '@/lib/nmaps_pick_point_notify'
import { notifyNmapsUrlChange } from '@/lib/nmaps_url_notify'

const MAP_DISCOVERY_POLL_MS = 500
const MAP_DISCOVERY_TIMEOUT_MS = 30_000

type YmapsMapLike = {
  getCenter: () => [number, number]
  getZoom: () => number
  events: {
    add: (event: string, handler: (...args: unknown[]) => void) => void
    remove: (event: string, handler: (...args: unknown[]) => void) => void
  }
}

type YmapsGlobal = {
  Map?: new (...args: unknown[]) => YmapsMapLike
  ready?: (callback: () => void) => void
}

type YmapsMapWithContainer = {
  container?: { fitToViewport?: () => void }
}

const isNonNullObject = (value: unknown): value is Record<string, unknown> => {
  let result = false
  if (typeof value === 'object') {
    if (value !== null) {
      result = true
    }
  }
  return result
}

const hasYmapsEventsAdd = (record: Record<string, unknown>): boolean => {
  const events = record.events
  let result = false
  if (isNonNullObject(events)) {
    if (typeof events.add === 'function') {
      result = true
    }
  }
  return result
}

const isYmapsMapLike = (value: unknown): value is YmapsMapLike => {
  let result = false
  if (isNonNullObject(value)) {
    if (typeof value.getCenter === 'function') {
      if (typeof value.getZoom === 'function') {
        if (hasYmapsEventsAdd(value)) {
          result = true
        }
      }
    }
  }
  return result
}

const findMapInElement = (element: Element): YmapsMapLike | null => {
  const record = element as unknown as Record<string, unknown>
  const keys = Object.keys(record)
  let map: YmapsMapLike | null = null
  for (let index = 0; index < keys.length && map === null; index += 1) {
    const value = record[keys[index]]
    if (isYmapsMapLike(value)) {
      map = value
    }
  }
  return map
}

const findMapInSelector = (selector: string): YmapsMapLike | null => {
  const elements = document.querySelectorAll(selector)
  let map: YmapsMapLike | null = null
  for (let index = 0; index < elements.length && map === null; index += 1) {
    const candidate = findMapInElement(elements[index])
    if (candidate) {
      map = candidate
    }
  }
  return map
}

/** Ищет экземпляр ymaps-карты через DOM-сканирование контейнеров. */
const findMapInstanceFromDom = (): YmapsMapLike | null => {
  const selectors = [
    "[class*='ymaps-2'][class*='-map']",
    "[class*='ymaps'][class*='map']",
    '.ymaps-map',
  ]

  let map: YmapsMapLike | null = null
  for (let index = 0; index < selectors.length && map === null; index += 1) {
    const candidate = findMapInSelector(selectors[index])
    if (candidate) {
      map = candidate
    }
  }
  return map
}

/** Находит карту через глобальный ymaps API (если доступен). */
const findMapFromGlobalYmaps = (): YmapsMapLike | null => {
  const windowRecord = window as unknown as Record<string, unknown>
  const ymaps = windowRecord.ymaps as YmapsGlobal | undefined
  let map: YmapsMapLike | null = null
  if (ymaps) {
    map = findMapInstanceFromDom()
  }
  return map
}

const dispatchWindowResize = (): void => {
  const resizeEvent = new Event('resize')
  window.dispatchEvent(resizeEvent)
}

const findActiveMap = (): YmapsMapLike | null => {
  return findMapFromGlobalYmaps() ?? findMapInstanceFromDom()
}

/** Пересчитывает размер карты после изменения layout страницы. */
const requestMapRepaint = (): void => {
  dispatchWindowResize()

  const map = findActiveMap()
  if (map) {
    try {
      const container = (map as unknown as YmapsMapWithContainer).container
      container?.fitToViewport?.()
    } catch {
      // Объект карты мог быть уничтожен
    }
  }
}

const isValidMapView = (center: unknown, zoom: unknown): center is [number, number] => {
  let result = false
  if (Array.isArray(center)) {
    if (Number.isFinite(center[0])) {
      if (Number.isFinite(center[1])) {
        if (Number.isFinite(zoom)) {
          result = true
        }
      }
    }
  }
  return result
}

/** Подписывается на события карты и транслирует координаты через CustomEvent. */
const subscribeToMapEvents = (map: YmapsMapLike): void => {
  const handleBoundsChange = (): void => {
    try {
      const center = map.getCenter()
      const zoom = map.getZoom()
      if (isValidMapView(center, zoom)) {
        notifyNmapsBoundsChange({
          latitude: center[0],
          longitude: center[1],
          zoom,
        })
      }
    } catch {
      // Объект карты мог быть уничтожен
    }
  }

  map.events.add('boundschange', handleBoundsChange)
  map.events.add('actiontick', handleBoundsChange)
}

let globalActiveMapInstance: YmapsMapLike | null = null

/** Запускает поиск ymaps-карты с retry и таймаутом. */
const startMapDiscovery = (): void => {
  const startedAt = Date.now()

  const poll = (): void => {
    const timedOut = Date.now() - startedAt > MAP_DISCOVERY_TIMEOUT_MS
    if (!timedOut) {
      const map = findActiveMap()
      if (map) {
        globalActiveMapInstance = map
        subscribeToMapEvents(map)
      } else {
        setTimeout(poll, MAP_DISCOVERY_POLL_MS)
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poll, { once: true })
  } else {
    poll()
  }
}

type HistoryStateMethod = typeof history.pushState

const wrapHistoryMethod = (method: 'pushState' | 'replaceState', onChange: () => void): void => {
  const original: HistoryStateMethod = history[method].bind(history)
  const patched: HistoryStateMethod = (...args: Parameters<HistoryStateMethod>): void => {
    original(...args)
    queueMicrotask(onChange)
  }
  if (method === 'pushState') {
    history.pushState = patched
  } else {
    history.replaceState = patched
  }
}

const R = 6378137.0;
const e = 0.0818191908426;

function latLonToMercator(lat: number, lon: number) {
    const lonRad = lon * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const sinLat = Math.sin(latRad);
    const x = R * lonRad;
    const y = R * Math.log(Math.tan(Math.PI / 4 + latRad / 2) * Math.pow((1 - e * sinLat) / (1 + e * sinLat), e / 2));
    return { x, y };
}

function mercatorToLatLon(x: number, y: number) {
    const lon = x * 180 / (R * Math.PI);
    const ts = Math.exp(-y / R);
    let phi = Math.PI / 2 - 2 * Math.atan(ts);
    let dphi = 1.0;
    for (let i = 0; i < 15 && dphi > 1e-15; i++) {
        const con = e * Math.sin(phi);
        const newPhi = Math.PI / 2 - 2 * Math.atan(ts * Math.pow((1 - con) / (1 + con), e / 2));
        dphi = Math.abs(newPhi - phi);
        phi = newPhi;
    }
    const lat = phi * 180 / Math.PI;
    return { lat, lon };
}

function getCoordsFromUrlClick(clientX: number, clientY: number): number[] | null {
  const hash = window.location.hash
  const paramsStr = hash.split('?')[1]
  if (!paramsStr) return null
  const params = new URLSearchParams(paramsStr)
  const zStr = params.get('z')
  const llStr = params.get('ll')
  if (!zStr || !llStr) return null
  const z = parseFloat(zStr)
  const [lon, lat] = llStr.split(',').map(parseFloat)
  if (isNaN(z) || isNaN(lon) || isNaN(lat)) return null

  const EQUATOR = 40075016.685578488;
  const worldSize = 256 * Math.pow(2, z);
  const mpp = EQUATOR / worldSize;

  const centerMerc = latLonToMercator(lat, lon);
  const dxPx = clientX - window.innerWidth / 2;
  const dyPx = clientY - window.innerHeight / 2;

  const targetX = centerMerc.x + dxPx * mpp;
  const targetY = centerMerc.y - dyPx * mpp;

  const result = mercatorToLatLon(targetX, targetY);
  return [result.lat, result.lon];
}

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    window.addEventListener('hashchange', notifyNmapsUrlChange)
    window.addEventListener('popstate', notifyNmapsUrlChange)

    wrapHistoryMethod('pushState', notifyNmapsUrlChange)
    wrapHistoryMethod('replaceState', notifyNmapsUrlChange)

    startMapDiscovery()

    document.addEventListener(NMAPS_MAP_RESIZE_EVENT, requestMapRepaint)

    document.addEventListener('nmaps:centerMap', (event: Event) => {
      const customEvent = event as CustomEvent
      const { latitude, longitude, zoom } = customEvent.detail ?? {}
      const lat = Number(latitude)
      const lon = Number(longitude)
      const z = Number(zoom) || 18

      if (!isNaN(lat) && !isNaN(lon)) {
        const map = globalActiveMapInstance ?? findActiveMap()
        if (map) {
          try {
            // Ищем подходящий метод
            const centerMethod = ['setCenter', 'panTo', 'moveTo'].find(m => typeof (map as any)[m] === 'function')
            
            if (centerMethod) {
              ;(map as any)[centerMethod]([lon, lat], z, { duration: 300 })
              return
            }
          } catch (e) {
            // Игнорируем
          }
        }
        
        const newHash = `#!/?z=${z}&ll=${lon},${lat}`
        
        try {
          // Создаем и кликаем скрытую ссылку, чтобы SPA-роутер Яндекса перехватил переход
          const a = document.createElement('a')
          a.href = newHash
          a.style.display = 'none'
          document.body.appendChild(a)
          a.click()
          a.remove()
        } catch (e) {
           window.location.hash = newHash
        }
      }
    })

    let isPickingPoint = false
    document.addEventListener(NMAPS_START_PICK_POINT_EVENT, (event: Event) => {
      if (isPickingPoint) return

      const customEvent = event as CustomEvent
      const geomType = customEvent.detail?.geomType ?? 'Point'

      isPickingPoint = true

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

      const accumulatedCoords: number[][] = []
      const accumulatedPixels: { x: number; y: number }[] = []

      const redrawSvg = () => {
        svg.innerHTML = ''
        if (accumulatedPixels.length > 0) {
          const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
          const pointsStr = accumulatedPixels.map(p => `${p.x},${p.y}`).join(' ')
          
          if (geomType === 'Polygon' && accumulatedPixels.length > 2) {
             const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
             polygon.setAttribute('points', pointsStr)
             polygon.setAttribute('fill', 'rgba(0, 120, 255, 0.3)')
             polygon.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
             polygon.setAttribute('stroke-width', '2')
             svg.appendChild(polygon)
          } else {
             polyline.setAttribute('points', pointsStr)
             polyline.setAttribute('fill', 'none')
             polyline.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
             polyline.setAttribute('stroke-width', '2')
             svg.appendChild(polyline)
          }

          accumulatedPixels.forEach(p => {
             const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
             circle.setAttribute('cx', String(p.x))
             circle.setAttribute('cy', String(p.y))
             circle.setAttribute('r', '4')
             circle.setAttribute('fill', '#ffffff')
             circle.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
             circle.setAttribute('stroke-width', '2')
             svg.appendChild(circle)
          })
        }
      }

      const finishPicking = () => {
        if (accumulatedCoords.length === 0) {
          cleanup()
          return
        }

        if (geomType === 'Polygon' && accumulatedCoords.length > 2) {
           const first = accumulatedCoords[0]
           const last = accumulatedCoords[accumulatedCoords.length - 1]
           if (first[0] !== last[0] || first[1] !== last[1]) {
             accumulatedCoords.push([...first])
           }
        }

        try {
           notifyPointPicked(accumulatedCoords, geomType)
        } catch (error) {
           showError('Ошибка завершения: ' + (error instanceof Error ? error.message : String(error)))
        } finally {
           cleanup()
        }
      }

      const cleanup = () => {
        isPickingPoint = false
        overlay.remove()
        document.removeEventListener('keydown', handleKeyDown)
      }

      const showError = (msg: string) => {
        const errDiv = document.createElement('div')
        errDiv.style.position = 'fixed'
        errDiv.style.top = '10px'
        errDiv.style.left = '50%'
        errDiv.style.transform = 'translateX(-50%)'
        errDiv.style.background = 'red'
        errDiv.style.color = 'white'
        errDiv.style.padding = '10px'
        errDiv.style.zIndex = '99999999'
        errDiv.textContent = msg
        document.body.appendChild(errDiv)
        setTimeout(() => errDiv.remove(), 5000)
      }

      const handleOverlayClick = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        
        try {
          const map = globalActiveMapInstance ?? findActiveMap()
          let coords: number[] | null = null
          
          if (map) {
            const m = map as any
            if (m.converter && m.options) {
              const projection = m.options.get('projection')
              const globalPixels = m.converter.pageToGlobal([event.clientX, event.clientY])
              coords = projection.fromGlobalPixels(globalPixels, m.getZoom())
            } else {
              coords = m.getCenter()
            }
          }
          
          if (!coords) {
             coords = getCoordsFromUrlClick(event.clientX, event.clientY)
          }

          if (Array.isArray(coords) && coords.length === 2) {
             accumulatedCoords.push([coords[0], coords[1]])
             accumulatedPixels.push({ x: event.clientX, y: event.clientY })
             
             if (geomType === 'Point') {
               finishPicking()
             } else {
               redrawSvg()
             }
          } else {
            throw new Error('Не удалось получить координаты ни через API, ни через URL')
          }
        } catch (error) {
          showError('Ошибка получения координат: ' + (error instanceof Error ? error.message : String(error)))
          cleanup()
        }
      }

      const handleKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault()
            finishPicking()
         }
      }

      overlay.addEventListener('mousedown', handleOverlayClick)
      overlay.addEventListener('dblclick', (e) => {
         e.preventDefault()
         e.stopPropagation()
         finishPicking()
      })
      document.addEventListener('keydown', handleKeyDown)
    })
  },
})
