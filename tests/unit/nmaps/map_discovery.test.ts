// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  findMapInElement,
  hasYmapsEventsAdd,
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
})
