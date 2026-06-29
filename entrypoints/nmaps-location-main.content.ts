import { defineContentScript } from 'wxt/utils/define-content-script'
import { notifyNmapsBoundsChange } from '@/lib/nmaps_bounds_notify'
import { NMAPS_MAP_RESIZE_EVENT } from '@/lib/nmaps_map_resize_notify'
import {
  NMAPS_CANCEL_PICK_POINT_EVENT,
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
  let map: YmapsMapLike | null = null
  for (const key in element) {
    try {
      const value = (element as any)[key]
      if (isYmapsMapLike(value)) {
        map = value
        break
      }
    } catch {
      // Ignored cross-origin or illegal invocation errors
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

const findMapInstanceFromDom = (): YmapsMapLike | null => {
  const selectors = [
    "[class*='ymaps-2'][class*='-map']",
    "[class*='ymaps'][class*='map']",
    '.ymaps-map',
    '.nk-map *', // scan all descendants of nk-map
    '[class*="ymaps"]', // scan any element with ymaps in its class
  ]

  let map: YmapsMapLike | null = null
  for (let index = 0; index < selectors.length && map === null; index += 1) {
    const _elements = document.querySelectorAll(selectors[index])
    const candidate = findMapInSelector(selectors[index])
    if (candidate) {
      map = candidate
    }
  }

  return map
}

/** Находит карту через глобальный ymaps API (если доступен). */
const findMapFromGlobalYmaps = (): YmapsMapLike | null => {
  const windowRecord = globalThis as unknown as Record<string, unknown>
  const ymaps = windowRecord.ymaps as YmapsGlobal | undefined
  let map: YmapsMapLike | null = null
  if (ymaps) {
    map = findMapInstanceFromDom()
  }
  return map
}

const dispatchWindowResize = (): void => {
  // Имитируем изменение размера окна на 1px, чтобы обмануть React-компоненты,
  // которые проверяют (prevWidth === globalThis.innerWidth) перед тем как обновить карту.
  // Держим поддельное значение 1 секунду и периодически спамим resize,
  // чтобы пробить любой throttle/debounce внутри Яндекса.
  const w = globalThis.innerWidth
  const h = globalThis.innerHeight

  Object.defineProperty(globalThis, 'innerWidth', { value: w + 1, configurable: true })
  Object.defineProperty(globalThis, 'innerHeight', { value: h + 1, configurable: true })

  // Спамим событиями resize каждую 100мс
  const intervals = [0, 100, 200, 300, 500, 800]
  intervals.forEach((delay) => {
    if (delay === 0) {
      globalThis.dispatchEvent(new Event('resize'))
    } else {
      setTimeout(() => globalThis.dispatchEvent(new Event('resize')), delay)
    }
  })

  // Через 1 секунду возвращаем как было
  setTimeout(() => {
    delete (globalThis as any).innerWidth
    delete (globalThis as any).innerHeight
    globalThis.dispatchEvent(new Event('resize'))
  }, 1000)
}

const findActiveMap = (): YmapsMapLike | null => {
  return findMapFromGlobalYmaps() ?? findMapInstanceFromDom()
}

/** Пересчитывает размер карты после изменения layout страницы и сохраняет центр. */
const requestMapRepaint = (event?: Event): void => {
  dispatchWindowResize()

  const map = globalActiveMapInstance ?? findActiveMap()
  if (!map) {
    return
  }

  try {
    const detailRaw = (event as CustomEvent)?.detail
    let detail: any = detailRaw
    if (typeof detailRaw === 'string') {
      try {
        detail = JSON.parse(detailRaw)
      } catch (e: any) {
        console.debug(e)
      }
    }

    let center: [number, number] | undefined
    let zoom: number | undefined

    if (detail && typeof detail.latitude === 'number' && typeof detail.longitude === 'number') {
      const center = [detail.longitude, detail.latitude]
      const zoom = detail.zoom

      setTimeout(() => {
        const map = globalActiveMapInstance ?? findActiveMap()
        if (map && center && zoom && typeof (map as any).setCenter === 'function') {
          try {
            ;(map as any).setCenter(center, zoom, { duration: 0 })
          } catch (e: any) {
            console.debug(e)
          }
        }
      }, 200)
    } else {
      try {
        center = map.getCenter()
        zoom = map.getZoom()
      } catch (e: any) {
        console.debug(e)
      }
    }

    const container = (map as unknown as YmapsMapWithContainer).container
    container?.fitToViewport?.()

    if (center && zoom !== undefined) {
      const centerMethod = ['setCenter', 'panTo', 'moveTo'].find(
        (m) => typeof (map as any)[m] === 'function',
      )
      if (centerMethod) {
        ;(map as any)[centerMethod](center, zoom, { duration: 0 })
      }
    }
  } catch (_err: any) {
    console.debug(_err)
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
    } catch (e: any) {
      // Объект карты мог быть уничтожен
      console.debug(e)
    }
  }

  map.events.add('boundschange', handleBoundsChange)
  map.events.add('actiontick', handleBoundsChange)
}

let globalActiveMapInstance: YmapsMapLike | null = null

// Перехватываем создание экземпляра Яндекс.Карт, чтобы 100% найти карту
const interceptYmaps = () => {
  if (typeof globalThis === 'undefined' || !(globalThis as any).ymaps) return
  const ymaps = (globalThis as any).ymaps

  if (ymaps.__mapInterceptSetupDone) return
  ymaps.__mapInterceptSetupDone = true

  let _Map = ymaps.Map
  if (_Map && !_Map.__intercepted) {
    const OriginalMap = _Map
    ymaps.Map = function (this: any, ...args: any[]) {
      const instance = new OriginalMap(...args)
      globalActiveMapInstance = instance as YmapsMapLike
      return instance
    }
    ymaps.Map.__intercepted = true
    ymaps.Map.prototype = OriginalMap.prototype
  } else if (!_Map) {
    Object.defineProperty(ymaps, 'Map', {
      get: () => _Map,
      set: (val) => {
        if (val && !val.__intercepted) {
          const OriginalMap = val
          _Map = function (this: any, ...args: any[]) {
            const instance = new OriginalMap(...args)
            globalActiveMapInstance = instance as YmapsMapLike
            return instance
          }
          _Map.__intercepted = true
          _Map.prototype = OriginalMap.prototype
        } else {
          _Map = val
        }
      },
      configurable: true,
    })
  }
}

// Запускаем перехват как можно раньше, перехватывая само присвоение globalThis.window.ymaps
const setupInterceptor = () => {
  if (typeof globalThis === 'undefined') return

  let _ymaps: any = (globalThis as any).ymaps
  if (_ymaps) {
    interceptYmaps()
  } else {
    Object.defineProperty(globalThis, 'ymaps', {
      get: () => _ymaps,
      set: (val) => {
        _ymaps = val
        if (val) {
          interceptYmaps()
        }
      },
      configurable: true,
    })
  }

  // На всякий случай оставляем поллинг
  const interval = setInterval(() => {
    if (typeof globalThis !== 'undefined' && _ymaps) {
      interceptYmaps()
    }
  }, 50)
  setTimeout(() => clearInterval(interval), 10000)
}
setupInterceptor()

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

const R = 6378137
const e = 0

function latLonToMercator(lat: number, lon: number) {
  const lonRad = (lon * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const sinLat = Math.sin(latRad)
  const x = R * lonRad
  const y =
    R *
    Math.log(Math.tan(Math.PI / 4 + latRad / 2) * ((1 - e * sinLat) / (1 + e * sinLat)) ** (e / 2))
  return { x, y }
}

function mercatorToLatLon(x: number, y: number) {
  const lon = (x * 180) / (R * Math.PI)
  const ts = Math.exp(-y / R)
  let phi = Math.PI / 2 - 2 * Math.atan(ts)
  let dphi = 1
  for (let i = 0; i < 15 && dphi > 1e-15; i++) {
    const con = e * Math.sin(phi)
    const newPhi = Math.PI / 2 - 2 * Math.atan(ts * ((1 - con) / (1 + con)) ** (e / 2))
    dphi = Math.abs(newPhi - phi)
    phi = newPhi
  }
  const lat = (phi * 180) / Math.PI
  return { lat, lon }
}

function getCoordsFromUrlClick(clientX: number, clientY: number): number[] | null {
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

  const EQUATOR = 40075016.685578488
  const worldSize = 256 * 2 ** z
  const mpp = EQUATOR / worldSize

  const centerMerc = latLonToMercator(lat, lon)

  let cx = globalThis.innerWidth / 2
  let cy = globalThis.innerHeight / 2

  // 1. Try to find crosshair element directly
  const crosshair = document.querySelector(
    '.nk-map-crosshair, [class*="crosshair"], .ymaps-map-crosshair',
  )
  if (crosshair) {
    const rect = crosshair.getBoundingClientRect()
    cx = rect.left + rect.width / 2
    cy = rect.top + rect.height / 2
  } else {
    // 2. Fallback to map container
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

  const dxPx = clientX - cx
  const dyPx = clientY - cy

  const targetX = centerMerc.x + dxPx * mpp
  const targetY = centerMerc.y - dyPx * mpp

  const result = mercatorToLatLon(targetX, targetY)

  return [result.lat, result.lon]
}

let customCollection: any = null

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    globalThis.addEventListener('hashchange', notifyNmapsUrlChange)
    globalThis.addEventListener('popstate', notifyNmapsUrlChange)

    wrapHistoryMethod('pushState', notifyNmapsUrlChange)
    wrapHistoryMethod('replaceState', notifyNmapsUrlChange)

    startMapDiscovery()

    document.addEventListener(NMAPS_MAP_RESIZE_EVENT, requestMapRepaint)

    document.addEventListener('nmaps:drawObjects', (event: Event) => {
      const customEvent = event as CustomEvent
      let detail = customEvent.detail
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail)
        } catch (e: any) {
          console.debug(e)
        }
      }

      const points = detail?.points
      if (!Array.isArray(points)) return

      const ymaps = (globalThis as any).ymaps
      if (!ymaps) {
        return
      }

      const map = globalActiveMapInstance ?? findActiveMap()
      if (!map) {
        return
      }

      if (!customCollection) {
        customCollection = new ymaps.GeoObjectCollection(
          {},
          {
            strokeColor: '#0078FF',
            strokeWidth: 3,
            fillColor: 'rgba(0, 120, 255, 0.25)',
          },
        )
        ;(map as any).geoObjects.add(customCollection)
      }

      customCollection.removeAll()

      points.forEach((p: any) => {
        if (p.geomType === 'Polygon' && p.geomCoords) {
          const polygon = new ymaps.Polygon(
            [p.geomCoords],
            {
              hintContent: p.name || p.noteDesc,
            },
            {
              fill: !p.id, // Отключаем заливку, если объект загружен из index.json (есть id)
            },
          )
          customCollection.add(polygon)
        } else if (p.geomType === 'LineString' && p.geomCoords) {
          const polyline = new ymaps.Polyline(p.geomCoords, {
            hintContent: p.name || p.noteDesc,
          })
          customCollection.add(polyline)
        } else {
          const placemark = new ymaps.Placemark([p.longitude, p.latitude], {
            hintContent: p.name || p.noteDesc,
          })
          customCollection.add(placemark)
        }
      })
    })

    const applyFallbackRouting = (z: number, lon: number, lat: number) => {
      const newHash = `#!/?z=${z}&ll=${lon},${lat}`
      try {
        const a = document.createElement('a')
        a.href = newHash
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        a.remove()
      } catch (e: any) {
        console.debug(e)
        globalThis.location.hash = newHash
      }
    }

    const getApiCoords = (event: MouseEvent): number[] | null => {
      const map = globalActiveMapInstance ?? findActiveMap()
      if (!map) return null
      const m = map as any
      if (m.converter && m.options) {
        const projection = m.options.get('projection')
        const globalPixels = m.converter.pageToGlobal([event.clientX, event.clientY])
        return projection.fromGlobalPixels(globalPixels, m.getZoom())
      }
      return m.getCenter()
    }

    const parseCenterDetail = (detailRaw: unknown) => {
      let detail = detailRaw
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail)
        } catch (e: any) {
          console.debug(e)
        }
      }
      return detail as any
    }

    const handleCenterMapApi = (lat: number, lon: number, z: number, duration: number): boolean => {
      const map = globalActiveMapInstance ?? findActiveMap()
      if (!map) return false
      try {
        const centerMethod = ['setCenter', 'panTo', 'moveTo'].find(
          (m) => typeof (map as any)[m] === 'function',
        )
        if (centerMethod) {
          ;(map as any)[centerMethod]([lon, lat], z, { duration })
          return true
        }
      } catch (e: any) {
        console.debug(e)
      }
      return false
    }

    document.addEventListener('nmaps:centerMap', (event: Event) => {
      const customEvent = event as CustomEvent
      const detail = parseCenterDetail(customEvent.detail)
      const { latitude, longitude, zoom, duration } = detail ?? {}
      const lat = Number(latitude)
      const lon = Number(longitude)
      const z = Number(zoom) || 18
      const dur = typeof duration === 'number' ? duration : 0

      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        if (!handleCenterMapApi(lat, lon, z, dur)) {
          applyFallbackRouting(z, lon, lat)
        }
      }
    })

    let isPickingPoint = false
    let activeCleanup: (() => void) | null = null

    document.addEventListener(NMAPS_CANCEL_PICK_POINT_EVENT, () => {
      if (activeCleanup) {
        activeCleanup()
      }
    })

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
          const pointsStr = accumulatedPixels.map((p) => `${p.x},${p.y}`).join(' ')

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

          accumulatedPixels.forEach((p) => {
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
          const last = accumulatedCoords.at(-1)!
          if (first[0] !== last[0] || first[1] !== last[1]) {
            accumulatedCoords.push([...first])
          }
        }

        try {
          notifyPointPicked(accumulatedCoords, geomType)
        } catch (error) {
          showError(`Ошибка завершения: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
          cleanup()
        }
      }

      const cleanup = () => {
        isPickingPoint = false
        overlay.remove()
        document.removeEventListener('keydown', handleKeyDown)
        activeCleanup = null
      }
      activeCleanup = cleanup

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
          const apiCoords = getApiCoords(event)

          const urlCoords = getCoordsFromUrlClick(event.clientX, event.clientY)

          // FORCE using urlCoords because API coords seem to have a 1.5m systematic offset
          const coords = urlCoords || apiCoords

          if (Array.isArray(coords) && coords.length === 2) {
            if (coords === urlCoords) {
              accumulatedCoords.push([coords[0], coords[1]])
            } else if (coords === apiCoords) {
              // API coords are [lon, lat], we must swap them to [lat, lon] for NotesTab
              accumulatedCoords.push([coords[1], coords[0]])
            }

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
          console.error('[NMap Uploader] Overlay click error:', error)
          showError(
            'Ошибка получения координат: ' +
              (error instanceof Error ? error.message : String(error)),
          )
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
