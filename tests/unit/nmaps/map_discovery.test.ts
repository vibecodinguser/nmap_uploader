// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  findMapInElement,
  hasYmapsEventsAdd,
  hookYmapsModuleMap,
  isNonNullObject,
  isYmapsMapLike,
} from '@/lib/nmaps/map_discovery'

describe('nmaps/map_discovery', () => {
  it('isNonNullObject корректно фильтрует примитивы и null', () => {
    expect(isNonNullObject({})).toBe(true)
    expect(isNonNullObject(null)).toBe(false)
    expect(isNonNullObject(123)).toBe(false)
    expect(isNonNullObject('str')).toBe(false)
  })

  it('hasYmapsEventsAdd проверяет наличие events.add функции', () => {
    expect(hasYmapsEventsAdd({ events: { add: () => {} } })).toBe(true)
    expect(hasYmapsEventsAdd({ events: {} })).toBe(false)
    expect(hasYmapsEventsAdd({})).toBe(false)
  })

  it('isYmapsMapLike определяет сигнатуру экземпляра карты', () => {
    const fakeMap = {
      getCenter: () => [55.75, 37.61],
      getZoom: () => 15,
      events: {
        add: () => {},
        remove: () => {},
      },
    }
    expect(isYmapsMapLike(fakeMap)).toBe(true)
    expect(isYmapsMapLike({ getCenter: () => {} })).toBe(false)
  })

  it('findMapInElement извлекает карту из скрытых свойств DOM элемента', () => {
    const el = document.createElement('div')
    const fakeMap = {
      getCenter: () => [55.75, 37.61],
      getZoom: () => 15,
      events: {
        add: () => {},
        remove: () => {},
      },
    }
    ;(el as unknown as Record<string, unknown>).__ymaps_instance__ = fakeMap
    expect(findMapInElement(el)).toBe(fakeMap)
  })

  it('hookYmapsModuleMap возвращает false если modules.require отсутствует', () => {
    expect(hookYmapsModuleMap(null, () => {})).toBe(false)
    expect(hookYmapsModuleMap({}, () => {})).toBe(false)
    expect(hookYmapsModuleMap({ modules: {} }, () => {})).toBe(false)
  })

  it('hookYmapsModuleMap перехватывает экземпляр карты при вызове методов прототипа', () => {
    let capturedMap: unknown = null
    const onInstance = (map: unknown) => {
      capturedMap = map
    }

    class FakeMap {
      options = { get: () => null }
      events = { add: () => {}, remove: () => {} }
      getCenter() {
        return [55.75, 37.61]
      }
      getZoom() {
        return 16
      }
    }

    const fakeYmaps = {
      modules: {
        require: (modules: string[], callback: (MapConstructor: unknown) => void) => {
          if (modules.includes('Map')) {
            callback(FakeMap)
          }
        },
      },
    }

    const hooked = hookYmapsModuleMap(fakeYmaps, onInstance)
    expect(hooked).toBe(true)

    const mapInstance = new FakeMap()
    // Экземпляр перехватывается либо через конструктор, либо при вызове getZoom
    mapInstance.getZoom()

    expect(capturedMap).toBe(mapInstance)
  })
})
