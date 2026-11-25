// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import mapBridgeScript from '@/entrypoints/map-bridge.content'
import {
  calculateZoomFromBbox,
  checkAndNotifyTrackerDate,
  parseCenterMapMessage,
} from '@/lib/map_bridge'
import { NMAPS_POINT_PICKED_EVENT } from '@/lib/nmaps_pick_point_notify'
import { POINT_PICKED_ACTION, START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

describe('map_bridge: вычисления', () => {
  it('зум по точечному bbox — максимальный минус один', () => {
    expect(calculateZoomFromBbox([37, 55, 37, 55], 1000, 800)).toBe(17)
  })

  it('зум по валидному bbox попадает в границы редактора', () => {
    const zoom = calculateZoomFromBbox([37.0, 55.0, 37.5, 55.5], 1000, 800)
    expect(zoom).toBeGreaterThan(5)
    expect(zoom).toBeLessThanOrEqual(18)
  })

  it('по умолчанию не вычитает ширину панели: попап карту не перекрывает', () => {
    // Широкий bbox по долготе: именно там вычитание 425px меняло бы зум.
    const bbox = [37.0, 55.0, 39.0, 55.5]
    const withoutPanel = calculateZoomFromBbox(bbox, 1500, 800, 0)

    expect(calculateZoomFromBbox(bbox, 1500, 800)).toBe(withoutPanel)
    expect(calculateZoomFromBbox(bbox, 1500, 800, 425)).not.toBe(withoutPanel)
  })

  it('возвращает null при некорректных координатах', () => {
    expect(parseCenterMapMessage({ latitude: 'invalid' })).toBeNull()
    expect(parseCenterMapMessage({})).toBeNull()
  })

  it('разбирает координаты и зум', () => {
    expect(parseCenterMapMessage({ latitude: 55.75, longitude: 37.61, zoom: 15 })).toEqual({
      latitude: 55.75,
      longitude: 37.61,
      zoom: 15,
    })
  })

  it('считает зум из bbox', () => {
    const res = parseCenterMapMessage(
      { latitude: 55.75, longitude: 37.61, bbox: [37.0, 55.0, 37.5, 55.5] },
      1000,
      800,
    )
    expect(res?.latitude).toBe(55.75)
    expect(res?.zoom).toBeGreaterThan(5)
  })

  it('находит дату трекера и сообщает о смене один раз', () => {
    document.body.innerHTML = '<button class="nk-button__text">21.10.2026</button>'
    const onDateChange = vi.fn()

    const first = checkAndNotifyTrackerDate({ lastDate: '', onDateChange })
    expect(first).toBe('21.10.2026')
    expect(onDateChange).toHaveBeenCalledWith('21.10.2026')

    const second = checkAndNotifyTrackerDate({ lastDate: '21.10.2026', onDateChange })
    expect(second).toBe('21.10.2026')
    expect(onDateChange).toHaveBeenCalledTimes(1)
    document.body.innerHTML = ''
  })
})

describe('map-bridge.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>
  let messageListener: ((message: Record<string, unknown>) => void) | undefined

  beforeEach(() => {
    ctx = createContentScriptContext()
    messageListener = undefined
    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation((listener) => {
      messageListener = listener as (message: Record<string, unknown>) => void
    })
  })

  afterEach(() => {
    ctx.runInvalidated()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('пересылает центр карты в MAIN-мир событием', () => {
    const handler = vi.fn()
    document.addEventListener('nmaps:centerMap', handler)
    mapBridgeScript.main?.(ctx)

    messageListener?.({ action: 'centerMap', latitude: 55.7, longitude: 37.6, zoom: 14 })

    expect(handler).toHaveBeenCalledTimes(1)
    document.removeEventListener('nmaps:centerMap', handler)
  })

  it('возвращает выбранные координаты в background вместе с меткой источника', () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined as never)
    mapBridgeScript.main?.(ctx)

    messageListener?.({
      action: START_POINT_PICKING_ACTION,
      geomType: 'Point',
      source: 'notesPanel',
    })

    document.dispatchEvent(
      new CustomEvent(NMAPS_POINT_PICKED_EVENT, {
        detail: { coords: [[55.7, 37.6]], geomType: 'Point' },
      }),
    )

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: POINT_PICKED_ACTION,
      coords: [[55.7, 37.6]],
      geomType: 'Point',
      source: 'notesPanel',
    })
  })

  it('сообщает о прерванном рисовании пустым набором координат', () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined as never)
    mapBridgeScript.main?.(ctx)

    messageListener?.({
      action: START_POINT_PICKING_ACTION,
      geomType: 'LineString',
      source: 'notesPanel',
    })

    document.dispatchEvent(
      new CustomEvent(NMAPS_POINT_PICKED_EVENT, {
        detail: { coords: [], geomType: 'LineString' },
      }),
    )

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: POINT_PICKED_ACTION,
      coords: [],
      geomType: 'LineString',
      source: 'notesPanel',
    })
  })
})
