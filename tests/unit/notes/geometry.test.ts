import { describe, expect, it } from 'vitest'
import { geometryAnchor, geometryBounds, zoomForBounds } from '@/lib/notes/geometry/bounds'
import { circleRing, distanceMeters, radiusFromDrag } from '@/lib/notes/geometry/circle'
import { squareCornersFromDrag, squareFromCorners } from '@/lib/notes/geometry/square'

describe('squareFromCorners', () => {
  it('строит замкнутое кольцо из двух углов', () => {
    expect(squareFromCorners([37, 55], [38, 56])).toEqual([
      [37, 55],
      [38, 55],
      [38, 56],
      [37, 56],
      [37, 55],
    ])
  })

  it('отбрасывает вырожденные протяжки', () => {
    expect(squareFromCorners([37, 55], [37, 56])).toBeNull()
    expect(squareFromCorners([37, 55], [38, 55])).toBeNull()
  })
})

describe('squareCornersFromDrag', () => {
  it('нормализует углы независимо от направления протяжки', () => {
    expect(squareCornersFromDrag([38, 56], [37, 55])).toEqual([
      [37, 55],
      [38, 56],
    ])
  })
})

describe('circle', () => {
  it('строит замкнутое кольцо из центра и радиуса', () => {
    const ring = circleRing([37, 55], 1000, 8)

    expect(ring).toHaveLength(9)
    expect(ring[0]).toEqual(ring.at(-1))
    expect(ring[0][0]).not.toBe(37)
  })

  it('считает радиус по точке на окружности', () => {
    const center: [number, number] = [37, 55]
    const edge: [number, number] = [37, 55.001]

    const radius = radiusFromDrag(center, edge)
    expect(radius).toBeGreaterThan(100)
    expect(radius).toBeLessThan(130)
  })

  it('измеряет расстояние по большому кругу', () => {
    expect(distanceMeters([37, 55], [37, 55])).toBe(0)
  })
})

describe('bounds', () => {
  it('считает охват и центр площадной фигуры', () => {
    const geometry = {
      kind: 'Square' as const,
      corners: [
        [37, 55],
        [38, 56],
      ] as [[number, number], [number, number]],
    }

    expect(geometryBounds(geometry)).toEqual([37, 55, 38, 56])
    expect(geometryAnchor(geometry)).toEqual([37.5, 55.5])
  })

  it('возвращает координаты точки как центр', () => {
    expect(geometryAnchor({ kind: 'Point', coords: [37, 55] })).toEqual([37, 55])
    expect(geometryBounds({ kind: 'Point', coords: [37, 55] })).toEqual([37, 55, 37, 55])
  })

  it('подбирает зум по охвату', () => {
    const wide = zoomForBounds([30, 50, 40, 60])
    const narrow = zoomForBounds([37.6, 55.7, 37.61, 55.71])

    expect(narrow).toBeGreaterThan(wide)
    expect(wide).toBeGreaterThanOrEqual(4)
    expect(narrow).toBeLessThanOrEqual(19)
  })
})
