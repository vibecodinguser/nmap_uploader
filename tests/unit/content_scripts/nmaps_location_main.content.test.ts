// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NMAPS_BOUNDS_CHANGE_EVENT,
  parseBoundsChangeEvent,
} from '@/lib/nmaps_bounds_notify'
import { NMAPS_URL_CHANGE_EVENT } from '@/lib/nmaps_url_notify'
import { NMAPS_MAP_RESIZE_EVENT } from '@/lib/nmaps_map_resize_notify'
import nmapsLocationMainScript from '@/entrypoints/nmaps-location-main.content'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const runMain = (): void => {
  nmapsLocationMainScript.main?.(createContentScriptContext())
}

describe('nmaps-location-main.content', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.location.hash = '#!/objects/1?z=10&ll=37.6%2C55.7'
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('транслирует hashchange в CustomEvent смены URL', () => {
    const handler = vi.fn()
    document.addEventListener(NMAPS_URL_CHANGE_EVENT, handler)

    runMain()
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('транслирует pushState в CustomEvent смены URL', async () => {
    const handler = vi.fn()
    document.addEventListener(NMAPS_URL_CHANGE_EVENT, handler)

    runMain()
    handler.mockClear()

    history.pushState(null, '', '#!/objects/2?z=12&ll=38%2C56')
    await Promise.resolve()

    expect(handler).toHaveBeenCalled()
  })

  it('отправляет boundschange при событиях ymaps-карты', () => {
    const handler = vi.fn()
    document.addEventListener(NMAPS_BOUNDS_CHANGE_EVENT, handler)

    const boundsHandlers: Record<string, (...args: unknown[]) => void> = {}
    const mapElement = document.createElement('div')
    mapElement.className = 'ymaps-map'
    const mapInstance = {
      getCenter: () => [55.7, 37.6] as [number, number],
      getZoom: () => 12,
      events: {
        add: (event: string, handlerFn: (...args: unknown[]) => void) => {
          boundsHandlers[event] = handlerFn
        },
        remove: vi.fn(),
      },
    }
    ;(mapElement as unknown as Record<string, unknown>).__ymaps_map = mapInstance
    document.body.appendChild(mapElement)

    runMain()
    vi.runAllTimers()

    boundsHandlers.boundschange?.()

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0]?.[0] as Event
    expect(parseBoundsChangeEvent(event)).toEqual({
      longitude: 37.6,
      latitude: 55.7,
      zoom: 12,
    })
  })

  it('перерисовывает карту по событию resize панели', () => {
    const resizeSpy = vi.spyOn(window, 'dispatchEvent')
    const mapInstance = {
      getCenter: () => [55.7, 37.6] as [number, number],
      getZoom: () => 12,
      events: { add: vi.fn(), remove: vi.fn() },
      container: { fitToViewport: vi.fn() },
    }
    const mapElement = document.createElement('div')
    mapElement.className = 'ymaps-map'
    ;(mapElement as unknown as Record<string, unknown>).__ymaps_map = mapInstance
    document.body.appendChild(mapElement)

    runMain()
    vi.runAllTimers()

    resizeSpy.mockClear()
    document.dispatchEvent(new CustomEvent(NMAPS_MAP_RESIZE_EVENT))

    expect(resizeSpy).toHaveBeenCalledWith(expect.any(Event))
    expect(mapInstance.container.fitToViewport).toHaveBeenCalled()
  })
})
