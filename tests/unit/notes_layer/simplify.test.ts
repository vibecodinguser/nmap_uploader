import { describe, expect, it } from 'vitest'
import { SIMPLIFY_MAX_ZOOM, SIMPLIFY_TOLERANCE_PX, simplifyRing } from '@/lib/notes_layer/simplify'

/**
 * Упрощение контуров — чистая функция. Проверяем гарантии, на которых держится
 * отрисовка: концы и замыкание сохраняются, на крупном зуме ничего не
 * выбрасывается, а вырожденный результат не превращается в пустую фигуру.
 */
type Point = [number, number]

/** Прямая линия из `count` точек с шагом по долготе. */
const straightLine = (count: number, step = 0.0001): Point[] =>
  Array.from({ length: count }, (_, index) => [37.6 + index * step, 55.7] as Point)

/** Замкнутое кольцо-квадрат с дроблением каждой стороны. */
const denseSquare = (perSide: number, side = 0.01): Point[] => {
  const points: Point[] = []
  const [lon, lat] = [37.6, 55.7]
  for (let index = 0; index < perSide; index += 1) {
    points.push([lon + (side * index) / perSide, lat])
  }
  for (let index = 0; index < perSide; index += 1) {
    points.push([lon + side, lat + (side * index) / perSide])
  }
  for (let index = 0; index < perSide; index += 1) {
    points.push([lon + side - (side * index) / perSide, lat + side])
  }
  for (let index = 0; index < perSide; index += 1) {
    points.push([lon, lat + side - (side * index) / perSide])
  }
  points.push([lon, lat])
  return points
}

describe('что не упрощается', () => {
  it('короткий контур возвращается как есть', () => {
    const line = straightLine(4)

    expect(simplifyRing({ coordinates: line, zoom: 10 })).toEqual(line)
  })

  it('на крупном зуме вершины сохраняются все', () => {
    const line = straightLine(50)
    const result = simplifyRing({ coordinates: line, zoom: SIMPLIFY_MAX_ZOOM + 1 })

    expect(result).toHaveLength(50)
  })

  it('пустой контур не ломает расчёт', () => {
    expect(simplifyRing({ coordinates: [], zoom: 10 })).toEqual([])
  })
})

describe('линия', () => {
  it('прямая сжимается до двух концов', () => {
    const line = straightLine(100)
    const result = simplifyRing({ coordinates: line, zoom: 10 })

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(line[0])
    expect(result[result.length - 1]).toEqual(line[line.length - 1])
  })

  it('излом сохраняется', () => {
    const line: Point[] = [
      [37.6, 55.7],
      [37.61, 55.7],
      [37.62, 55.7],
      [37.62, 55.8],
      [37.62, 55.9],
    ]

    const result = simplifyRing({ coordinates: line, zoom: 10 })

    // Угол должен остаться: без него линия стала бы одной диагональю.
    expect(result.some((point) => point[1] === 55.8)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(3)
  })

  it('чем крупнее зум, тем больше вершин остаётся', () => {
    const wavy = Array.from({ length: 200 }, (_, index) => {
      const t = index / 200
      return [37.6 + t * 0.02, 55.7 + Math.sin(t * 40) * 0.0008] as Point
    })

    const far = simplifyRing({ coordinates: wavy, zoom: 8 })
    const near = simplifyRing({ coordinates: wavy, zoom: 14 })

    expect(near.length).toBeGreaterThan(far.length)
  })

  it('допуск влияет на степень сжатия', () => {
    const wavy = Array.from({ length: 200 }, (_, index) => {
      const t = index / 200
      return [37.6 + t * 0.02, 55.7 + Math.sin(t * 40) * 0.0008] as Point
    })

    const tight = simplifyRing({ coordinates: wavy, zoom: 12, tolerancePx: 0.2 })
    const loose = simplifyRing({ coordinates: wavy, zoom: 12, tolerancePx: 10 })

    expect(loose.length).toBeLessThan(tight.length)
  })
})

describe('полигон', () => {
  it('замкнутый контур остаётся замкнутым', () => {
    const square = denseSquare(40)
    const result = simplifyRing({ coordinates: square, zoom: 10 })

    expect(result[0]).toEqual(result[result.length - 1])
  })

  it('плотный квадрат сжимается до углов, а не до половины', () => {
    const square = denseSquare(50)
    const result = simplifyRing({ coordinates: square, zoom: 10 })

    // Четыре угла плюс замыкание; главное — не меньше трёх точек и не «половина».
    expect(result.length).toBeGreaterThanOrEqual(4)
    expect(result.length).toBeLessThan(20)
  })

  it('фигура не вырождается: точек остаётся достаточно для отрисовки', () => {
    const square = denseSquare(20)
    const result = simplifyRing({ coordinates: square, zoom: 10 })

    expect(result.length).toBeGreaterThanOrEqual(4)
  })

  it('незамкнутый контур полигоном не считается и не замыкается', () => {
    const line = straightLine(50)
    const result = simplifyRing({ coordinates: line, zoom: 8 })

    expect(result[0]).not.toEqual(result[result.length - 1])
  })
})

describe('нагрузка', () => {
  it('десять тысяч вершин упрощаются без переполнения стека', () => {
    const huge = Array.from({ length: 10_000 }, (_, index) => {
      const t = index / 10_000
      return [37.6 + t * 0.5, 55.7 + Math.sin(t * 200) * 0.002] as Point
    })

    const started = performance.now()
    const result = simplifyRing({ coordinates: huge, zoom: 14 })
    const elapsed = performance.now() - started

    // Главное — не упасть на глубине рекурсии и не потерять форму.
    expect(result.length).toBeGreaterThan(2)
    expect(result.length).toBeLessThan(huge.length)
    expect(elapsed).toBeLessThan(500)
  })

  it('значение допуска по умолчанию задано явно', () => {
    expect(SIMPLIFY_TOLERANCE_PX).toBeGreaterThan(0)
  })
})
