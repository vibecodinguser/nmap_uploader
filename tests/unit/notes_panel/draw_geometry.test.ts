// @vitest-environment node

/**
 * Геометрия из нарисованного.
 *
 * Квадрат и круг задаются двумя точками, поэтому здесь проверяется, что из
 * протяжки получается именно фигура, а не вырожденный контур.
 */
import { describe, expect, it } from 'vitest'
import { geometryFromDrawCoords } from '@/hooks/useNotesPanel'
import { geometryBounds } from '@/lib/notes/model/geometry'

describe('geometryFromDrawCoords: точка, линия, многоугольник', () => {
  it('точка берёт первую координату', () => {
    expect(geometryFromDrawCoords('Point', [[37.6, 55.7]])).toEqual({
      kind: 'Point',
      coords: [37.6, 55.7],
    })
  })

  it('линия требует минимум две вершины', () => {
    expect(geometryFromDrawCoords('Line', [[37.6, 55.7]])).toBeNull()
    expect(
      geometryFromDrawCoords('Line', [
        [37.6, 55.7],
        [37.7, 55.8],
      ]),
    ).toEqual({
      kind: 'Line',
      coords: [
        [37.6, 55.7],
        [37.7, 55.8],
      ],
    })
  })

  it('многоугольник требует минимум три вершины', () => {
    expect(
      geometryFromDrawCoords('Polygon', [
        [37.6, 55.7],
        [37.7, 55.8],
      ]),
    ).toBeNull()
  })
})

describe('geometryFromDrawCoords: квадрат', () => {
  it('строит квадрат по двум противоположным углам', () => {
    const geometry = geometryFromDrawCoords('Square', [
      [37.6, 55.7],
      [37.8, 55.9],
    ])

    expect(geometry?.kind).toBe('Square')
    expect(geometryBounds(geometry!)).toEqual([37.6, 55.7, 37.8, 55.9])
  })

  it('не зависит от направления протяжки', () => {
    const forward = geometryFromDrawCoords('Square', [
      [37.6, 55.7],
      [37.8, 55.9],
    ])
    const backward = geometryFromDrawCoords('Square', [
      [37.8, 55.9],
      [37.6, 55.7],
    ])

    expect(forward).toEqual(backward)
  })

  it('отбрасывает протяжку по одной оси', () => {
    expect(
      geometryFromDrawCoords('Square', [
        [37.6, 55.7],
        [37.8, 55.7],
      ]),
    ).toBeNull()
    expect(
      geometryFromDrawCoords('Square', [
        [37.6, 55.7],
        [37.6, 55.9],
      ]),
    ).toBeNull()
  })

  it('без второй точки фигуры нет', () => {
    expect(geometryFromDrawCoords('Square', [[37.6, 55.7]])).toBeNull()
  })
})

describe('geometryFromDrawCoords: круг', () => {
  it('считает радиус по точке на окружности', () => {
    const geometry = geometryFromDrawCoords('Circle', [
      [37.6, 55.7],
      [37.6, 55.71],
    ])

    expect(geometry?.kind).toBe('Circle')
    if (geometry?.kind === 'Circle') {
      expect(geometry.center).toEqual([37.6, 55.7])
      expect(geometry.radiusMeters).toBeGreaterThan(1000)
      expect(geometry.radiusMeters).toBeLessThan(1200)
    }
  })

  it('нулевая протяжка не даёт круга', () => {
    expect(
      geometryFromDrawCoords('Circle', [
        [37.6, 55.7],
        [37.6, 55.7],
      ]),
    ).toBeNull()
  })

  it('без второй точки фигуры нет', () => {
    expect(geometryFromDrawCoords('Circle', [[37.6, 55.7]])).toBeNull()
  })
})
