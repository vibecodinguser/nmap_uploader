/**
 * Геометрия разреза линии растительности.
 *
 * Проверяем поведение, а не реализацию: кольцо размыкается в одну линию,
 * открытая линия делится на две, а вырожденные разрезы не проходят.
 */
import { describe, expect, it } from 'vitest'
import {
  findNearestPointOnPolyline,
  isClosedLine,
  lineLengthMeters,
  segmentLengthMeters,
  splitLineAtCut,
} from '@/lib/vegetation_cut/geometry'

// Квадрат примерно 100 × 100 м около Краснодарского края.
const RING: number[][] = [
  [41.42, 44.84],
  [41.421, 44.84],
  [41.421, 44.841],
  [41.42, 44.841],
  [41.42, 44.84],
]

const OPEN_LINE: number[][] = [
  [41.42, 44.84],
  [41.421, 44.84],
  [41.422, 44.84],
  [41.423, 44.84],
]

describe('isClosedLine', () => {
  it('узнаёт кольцо по совпадающим концам', () => {
    expect(isClosedLine(RING)).toBe(true)
  })

  it('не считает кольцом открытую линию', () => {
    expect(isClosedLine(OPEN_LINE)).toBe(false)
  })

  it('не считает кольцом линию из двух точек', () => {
    expect(
      isClosedLine([
        [41.42, 44.84],
        [41.42, 44.84],
      ]),
    ).toBe(false)
  })
})

describe('lineLengthMeters', () => {
  it('считает длину по метрам, а не по градусам', () => {
    const oneDegreeLatitude = segmentLengthMeters([0, 0], [0, 1])
    expect(oneDegreeLatitude).toBeGreaterThan(110_000)
    expect(oneDegreeLatitude).toBeLessThan(112_000)
    expect(lineLengthMeters(RING)).toBeGreaterThan(300)
  })
})

describe('findNearestPointOnPolyline', () => {
  const square: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
    [0, 0],
  ]

  it('находит ближайший отрезок и долю вдоль него', () => {
    const nearest = findNearestPointOnPolyline(square, [50, 6])
    expect(nearest).not.toBeNull()
    expect(nearest?.segmentIndex).toBe(0)
    expect(nearest?.ratio).toBeCloseTo(0.5, 5)
    expect(nearest?.distance).toBeCloseTo(6, 5)
  })

  it('находит клик на замыкающем отрезке кольца', () => {
    // Левый край квадрата — отрезок от последней вершины к первой. Он такая же
    // сторона кольца, как остальные: совпадает с началом только последняя точка.
    const nearest = findNearestPointOnPolyline(square, [0, 50])
    expect(nearest?.segmentIndex).toBe(3)
    expect(nearest?.ratio).toBeCloseTo(0.5, 5)
    expect(nearest?.distance).toBeCloseTo(0, 5)
  })

  it('возвращает null для вырожденной линии', () => {
    expect(findNearestPointOnPolyline([[0, 0]], [1, 1])).toBeNull()
  })
})

describe('splitLineAtCut', () => {
  it('размыкает кольцо в одну линию с совпадающими концами', () => {
    const parts = splitLineAtCut(RING, { segmentIndex: 0, ratio: 0.5, distance: 0 })

    expect(parts).toHaveLength(1)
    const [part] = parts ?? []
    expect(part).toHaveLength(RING.length + 1)
    expect(part[0]).toEqual(part[part.length - 1])
    expect(part[0][0]).toBeCloseTo(41.4205, 6)
  })

  it('делит открытую линию на две части с общей точкой', () => {
    const parts = splitLineAtCut(OPEN_LINE, { segmentIndex: 1, ratio: 0.5, distance: 0 })

    expect(parts).toHaveLength(2)
    const [left, right] = parts ?? []
    expect(left).toHaveLength(3)
    expect(right).toHaveLength(3)
    expect(left[left.length - 1]).toEqual(right[0])
    expect(left[0]).toEqual(OPEN_LINE[0])
    expect(right[right.length - 1]).toEqual(OPEN_LINE[OPEN_LINE.length - 1])
  })

  it('режет по существующей вершине, не добавляя точку', () => {
    const parts = splitLineAtCut(OPEN_LINE, { segmentIndex: 1, ratio: 1, distance: 0 })

    expect(parts).toEqual([
      [OPEN_LINE[0], OPEN_LINE[1], OPEN_LINE[2]],
      [OPEN_LINE[2], OPEN_LINE[3]],
    ])
  })

  it('отказывает, если часть получилась из одной точки', () => {
    const parts = splitLineAtCut(OPEN_LINE, { segmentIndex: 0, ratio: 0, distance: 0 })
    expect(parts).toBeNull()
  })

  it('отказывает, если часть короче метра', () => {
    const parts = splitLineAtCut(
      OPEN_LINE,
      { segmentIndex: 1, ratio: 0.999, distance: 0 },
      { minPartLengthMeters: 500 },
    )
    expect(parts).toBeNull()
  })

  it('не режет вне границ линии', () => {
    expect(splitLineAtCut(OPEN_LINE, { segmentIndex: 9, ratio: 0.5, distance: 0 })).toBeNull()
  })
})
