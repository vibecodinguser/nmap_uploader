import { defineContentScript } from 'wxt/utils/define-content-script'
import { notifyNmapsBoundsChange } from '@/lib/nmaps_bounds_notify'
import { NMAPS_MAP_RESIZE_EVENT } from '@/lib/nmaps_map_resize_notify'
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

/** Ищет экземпляр ymaps-карты через DOM-сканирование контейнеров. */
const findMapInstanceFromDom = (): YmapsMapLike | null => {
  const selectors = [
    '[class*="ymaps-2"][class*="-map"]',
    '[class*="ymaps"][class*="map"]',
    '.ymaps-map',
  ]

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector)
    for (const element of elements) {
      // ymaps 2.x хранит ссылку на карту в свойствах DOM-элемента
      const record = element as unknown as Record<string, unknown>
      for (const key of Object.keys(record)) {
        const value = record[key] as Record<string, unknown> | undefined
        if (
          value &&
          typeof value === 'object' &&
          typeof value.getCenter === 'function' &&
          typeof value.getZoom === 'function' &&
          value.events &&
          typeof (value.events as Record<string, unknown>).add === 'function'
        ) {
          return value as unknown as YmapsMapLike
        }
      }
    }
  }

  return null
}

/** Находит карту через глобальный ymaps API (если доступен). */
const findMapFromGlobalYmaps = (): YmapsMapLike | null => {
  const ymaps = (window as unknown as Record<string, unknown>).ymaps as YmapsGlobal | undefined
  if (!ymaps) return null

  // Пробуем найти карту из DOM при наличии ymaps
  return findMapInstanceFromDom()
}

/** Пересчитывает размер карты после изменения layout страницы. */
const requestMapRepaint = (): void => {
  window.dispatchEvent(new Event('resize'))

  const map = findMapFromGlobalYmaps() ?? findMapInstanceFromDom()
  if (!map) return

  try {
    const container = (map as unknown as { container?: { fitToViewport?: () => void } }).container
    container?.fitToViewport?.()
  } catch {
    // Объект карты мог быть уничтожен
  }
}

/** Подписывается на события карты и транслирует координаты через CustomEvent. */
const subscribeToMapEvents = (map: YmapsMapLike): void => {
  const handleBoundsChange = (): void => {
    try {
      const center = map.getCenter()
      const zoom = map.getZoom()
      if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return
      if (!Number.isFinite(zoom)) return

      // ymaps: center = [latitude, longitude]
      notifyNmapsBoundsChange({
        latitude: center[0],
        longitude: center[1],
        zoom,
      })
    } catch {
      // Объект карты мог быть уничтожен
    }
  }

  map.events.add('boundschange', handleBoundsChange)
  map.events.add('actiontick', handleBoundsChange)
}

/** Запускает поиск ymaps-карты с retry и таймаутом. */
const startMapDiscovery = (): void => {
  const startedAt = Date.now()

  const poll = (): void => {
    if (Date.now() - startedAt > MAP_DISCOVERY_TIMEOUT_MS) return

    const map = findMapFromGlobalYmaps() ?? findMapInstanceFromDom()
    if (map) {
      subscribeToMapEvents(map)
      return
    }

    setTimeout(poll, MAP_DISCOVERY_POLL_MS)
  }

  // Ждём загрузки DOM перед сканированием
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poll, { once: true })
  } else {
    poll()
  }
}

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    // Существующий механизм: уведомления об изменениях URL
    window.addEventListener('hashchange', notifyNmapsUrlChange)
    window.addEventListener('popstate', notifyNmapsUrlChange)

    const wrapHistoryMethod = (method: 'pushState' | 'replaceState'): void => {
      const original = history[method].bind(history) as History['pushState']

      history[method] = ((...args: Parameters<History['pushState']>) => {
        original(...args)
        queueMicrotask(notifyNmapsUrlChange)
      }) as History['pushState']
    }

    wrapHistoryMethod('pushState')
    wrapHistoryMethod('replaceState')

    // Новый механизм: реалтайм-синхронизация через ymaps API
    startMapDiscovery()

    document.addEventListener(NMAPS_MAP_RESIZE_EVENT, requestMapRepaint)
  },
})
