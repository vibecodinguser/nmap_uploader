// @vitest-environment happy-dom

/**
 * Маркеры разрезов на карте.
 *
 * Редактор НЯК отмечает нативную точку разреза красной «каплей» с ножницами.
 * У контурных частей таких точек нет, поэтому маркеры ставит инструмент — тем
 * же пресетом, чтобы вид совпадал.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCutPins, SPLIT_PIN_PRESET } from '@/lib/cut/pins'

type FakePin = { coordinates: number[]; options: Record<string, unknown> }

const installYmaps = () => {
  const pins: FakePin[] = []
  const added: FakePin[] = []
  const removed: FakePin[] = []

  const Placemark = class {
    private readonly record: FakePin

    constructor(coordinates: number[], _properties: object, options: Record<string, unknown>) {
      this.record = { coordinates, options }
      pins.push(this.record)
    }

    public getRecord(): FakePin {
      return this.record
    }
  }

  ;(globalThis as Record<string, unknown>).ymaps = { Placemark }

  const geoObjects = {
    add: (pin: { getRecord: () => FakePin }) => {
      added.push(pin.getRecord())
    },
    remove: (pin: { getRecord: () => FakePin }) => {
      removed.push(pin.getRecord())
    },
  }

  return { geoObjects, pins, added, removed }
}

const createMap = (geoObjects: unknown) => ({
  getZoom: () => 16,
  geoObjects,
})

beforeEach(() => {
  Reflect.deleteProperty(globalThis, 'ymaps')
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'ymaps')
  vi.restoreAllMocks()
})

describe('маркеры разрезов', () => {
  it('ставит маркеры нативным пресетом с ножницами', () => {
    const { geoObjects, added } = installYmaps()
    const pins = createCutPins(() => createMap(geoObjects))

    pins.show([
      [41.42, 44.84],
      [41.421, 44.84],
    ])

    expect(added).toHaveLength(2)
    expect(added[0].coordinates).toEqual([41.42, 44.84])
    expect(added[0].options.preset).toBe(SPLIT_PIN_PRESET)
    expect(SPLIT_PIN_PRESET).toBe('nk#splitRedPinIcon')
    expect(pins.count()).toBe(2)
  })

  it('заменяет прежние маркеры, а не копит их', () => {
    const { geoObjects, added, removed } = installYmaps()
    const pins = createCutPins(() => createMap(geoObjects))

    pins.show([[41.42, 44.84]])
    pins.show([[41.43, 44.85]])

    expect(removed).toHaveLength(1)
    expect(added).toHaveLength(2)
    expect(pins.count()).toBe(1)
  })

  it('снимает маркеры по запросу', () => {
    const { geoObjects, removed } = installYmaps()
    const pins = createCutPins(() => createMap(geoObjects))

    pins.show([[41.42, 44.84]])
    pins.clear()

    expect(removed).toHaveLength(1)
    expect(pins.count()).toBe(0)
  })

  it('берёт настоящую карту из обёртки редактора', () => {
    const { geoObjects, added } = installYmaps()
    const inner = createMap(geoObjects)
    const wrapper = { getYMap: () => inner }

    const pins = createCutPins(() => wrapper as never)
    pins.show([[41.42, 44.84]])

    expect(added).toHaveLength(1)
  })

  it('молчит без ymaps: разрез работает и без маркеров', () => {
    const geoObjects = { add: vi.fn(), remove: vi.fn() }
    const pins = createCutPins(() => createMap(geoObjects))

    expect(() => pins.show([[41.42, 44.84]])).not.toThrow()
    expect(geoObjects.add).not.toHaveBeenCalled()
    expect(pins.count()).toBe(0)
  })

  it('молчит, если карты нет', () => {
    installYmaps()
    const pins = createCutPins(() => null)

    expect(() => pins.show([[41.42, 44.84]])).not.toThrow()
    expect(pins.count()).toBe(0)
  })

  it('пустой список точек ничего не ставит', () => {
    const { geoObjects, added } = installYmaps()
    const pins = createCutPins(() => createMap(geoObjects))

    pins.show([])

    expect(added).toHaveLength(0)
    expect(pins.count()).toBe(0)
  })
})
