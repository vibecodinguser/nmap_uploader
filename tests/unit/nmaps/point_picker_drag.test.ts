// @vitest-environment happy-dom

/**
 * Протяжка для квадрата и круга в оверлее рисования.
 *
 * Квадрат и круг задаются двумя точками, поэтому рисуются не кликами, а
 * протяжкой: нажали, потянули, отпустили.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PointPickerOverlay } from '@/lib/nmaps'
import { NMAPS_POINT_PICKED_EVENT } from '@/lib/nmaps_pick_point_notify'

/**
 * Что вернёт API карты: порядок [lon, lat], как у `fromGlobalPixels`.
 *
 * Оверлей переставляет его в [lat, lon], а контент-скрипт — обратно в
 * [lon, lat] для заметки.
 */
const FAKE_COORDS: Record<string, [number, number]> = {
  '100,100': [37.6, 55.7],
  '300,300': [37.8, 55.8],
}

let picked: Array<{ coords: number[][]; geomType: string }> = []

const startPicker = (geomType: string): (() => void) =>
  new PointPickerOverlay(
    geomType,
    () => {},
    (event) => FAKE_COORDS[`${event.clientX},${event.clientY}`] ?? [37.6, 55.7],
  ).start()

const overlay = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>('div[style*="z-index: 2147483647"]')
  if (!element) throw new Error('оверлей не создан')
  return element
}

const mouse = (
  target: EventTarget,
  type: string,
  coords: { clientX: number; clientY: number },
): void => {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...coords }))
}

const collectPicked = (event: Event): void => {
  picked.push((event as CustomEvent).detail as { coords: number[][]; geomType: string })
}

beforeEach(() => {
  picked = []
  document.addEventListener(NMAPS_POINT_PICKED_EVENT, collectPicked)
})

afterEach(() => {
  document.removeEventListener(NMAPS_POINT_PICKED_EVENT, collectPicked)
  document.body.innerHTML = ''
})

describe('протяжка квадрата', () => {
  it('отдаёт две точки: начало и конец протяжки', () => {
    const stop = startPicker('Square')

    mouse(overlay(), 'mousedown', { clientX: 100, clientY: 100 })
    mouse(overlay(), 'mousemove', { clientX: 300, clientY: 300 })
    mouse(overlay(), 'mouseup', { clientX: 300, clientY: 300 })

    expect(picked).toHaveLength(1)
    expect(picked[0].geomType).toBe('Square')
    expect(picked[0].coords).toEqual([
      [55.7, 37.6],
      [55.8, 37.8],
    ])
    stop()
  })

  it('клик без движения отменяет рисование пустым набором', () => {
    const stop = startPicker('Square')

    mouse(overlay(), 'mousedown', { clientX: 100, clientY: 100 })
    mouse(overlay(), 'mouseup', { clientX: 100, clientY: 100 })

    expect(picked).toHaveLength(1)
    expect(picked[0].coords).toEqual([])
    stop()
  })

  it('рисует предпросмотр прямоугольником', () => {
    const stop = startPicker('Square')

    mouse(overlay(), 'mousedown', { clientX: 100, clientY: 100 })
    mouse(overlay(), 'mousemove', { clientX: 300, clientY: 200 })

    const rect = document.querySelector('svg rect')
    expect(rect?.getAttribute('x')).toBe('100')
    expect(rect?.getAttribute('y')).toBe('100')
    expect(rect?.getAttribute('width')).toBe('200')
    expect(rect?.getAttribute('height')).toBe('100')

    mouse(overlay(), 'mouseup', { clientX: 300, clientY: 200 })
    stop()
  })

  it('Esc прерывает протяжку', () => {
    const stop = startPicker('Square')

    mouse(overlay(), 'mousedown', { clientX: 100, clientY: 100 })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(picked[0].coords).toEqual([])
    stop()
  })
})

describe('протяжка круга', () => {
  it('отдаёт центр и точку на окружности', () => {
    const stop = startPicker('Circle')

    mouse(overlay(), 'mousedown', { clientX: 100, clientY: 100 })
    mouse(overlay(), 'mousemove', { clientX: 300, clientY: 300 })
    mouse(overlay(), 'mouseup', { clientX: 300, clientY: 300 })

    expect(picked[0].geomType).toBe('Circle')
    expect(picked[0].coords).toEqual([
      [55.7, 37.6],
      [55.8, 37.8],
    ])
    stop()
  })

  it('рисует предпросмотр окружностью с центром в точке нажатия', () => {
    const stop = startPicker('Circle')

    mouse(overlay(), 'mousedown', { clientX: 100, clientY: 100 })
    mouse(overlay(), 'mousemove', { clientX: 130, clientY: 140 })

    const circle = document.querySelector('svg circle')
    expect(circle?.getAttribute('cx')).toBe('100')
    expect(circle?.getAttribute('cy')).toBe('100')
    expect(Number(circle?.getAttribute('r'))).toBe(50)

    mouse(overlay(), 'mouseup', { clientX: 130, clientY: 140 })
    stop()
  })
})

describe('клики по вершинам не сломались', () => {
  it('линия накапливает вершины и завершается двойным кликом', () => {
    const stop = startPicker('LineString')

    for (const point of [
      { clientX: 100, clientY: 100 },
      { clientX: 300, clientY: 300 },
    ]) {
      mouse(overlay(), 'mousedown', point)
    }
    overlay().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

    expect(picked[0].geomType).toBe('LineString')
    expect(picked[0].coords).toEqual([
      [55.7, 37.6],
      [55.8, 37.8],
    ])
    stop()
  })

  it('точка завершается сразу после первого клика', () => {
    const stop = startPicker('Point')

    mouse(overlay(), 'mousedown', { clientX: 100, clientY: 100 })

    expect(picked).toHaveLength(1)
    expect(picked[0].coords).toEqual([[55.7, 37.6]])
    stop()
  })
})
