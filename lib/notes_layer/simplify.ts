/**
 * Упрощение линий и полигонов на дальних зумах.
 *
 * Линия из трассировки приходит с тысячами вершин. На крупном масштабе каждая
 * из них нужна, но при отдалении карты они сливаются в один пиксель, и
 * редактор считает контуры вхолостую. Здесь лишние вершины отбрасываются
 * алгоритмом Дугласа–Пекера: между оставшимися точками контур отклоняется не
 * больше чем на допуск.
 *
 * Расчёт идёт в мировых пикселях: допуск задаётся в пикселях экрана, а он
 * зависит от зума.
 */
import { toWorldPixels } from './clustering'

/** Допуск отклонения контура на экране, в пикселях. */
export const SIMPLIFY_TOLERANCE_PX = 1.2

/** До какого зума упрощать: с 15 вершины уже видны по отдельности. */
export const SIMPLIFY_MAX_ZOOM = 14

/** Меньше этого числа вершин упрощать нечего. */
const MIN_POINTS = 8

type Point = [number, number]

const squaredDistanceToSegment = (point: Point, start: Point, end: Point): number => {
  let x = start[0]
  let y = start[1]
  let dx = end[0] - x
  let dy = end[1] - y

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      x = end[0]
      y = end[1]
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }

  dx = point[0] - x
  dy = point[1] - y
  return dx * dx + dy * dy
}

/**
 * Какие вершины оставить. Возвращает индексы, а не сами точки: так исходные
 * координаты не проходят через обратное преобразование и не теряют точность.
 *
 * Без рекурсии: на линии в 10 000 вершин глубина рекурсии упёрлась бы в предел
 * стека, а упрощать нужно и такие данные.
 */
const keepIndices = (points: readonly Point[], tolerance: number): number[] => {
  if (points.length <= 2) return points.map((_, index) => index)

  const toleranceSq = tolerance * tolerance
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  const stack: Array<[number, number]> = [[0, points.length - 1]]

  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number]
    let maxDistance = 0
    let index = -1

    for (let position = first + 1; position < last; position += 1) {
      const distance = squaredDistanceToSegment(points[position], points[first], points[last])
      if (distance > maxDistance) {
        maxDistance = distance
        index = position
      }
    }

    if (index !== -1 && maxDistance > toleranceSq) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }

  const result: number[] = []
  for (let position = 0; position < points.length; position += 1) {
    if (keep[position] === 1) result.push(position)
  }
  return result
}

const isClosed = (points: readonly Point[]): boolean =>
  points.length > 3 &&
  points[0][0] === points[points.length - 1][0] &&
  points[0][1] === points[points.length - 1][1]

/**
 * Вершина, самая далёкая от первой.
 *
 * Для замкнутого контура это точка разрыва: Дуглас–Пекер на кольце, разорванном
 * в двух соседних вершинах, выбрасывает половину контура, потому что опорный
 * отрезок получается нулевой длины.
 */
const farthestFrom = (points: readonly Point[], origin: Point): number => {
  let best = 0
  let bestDistance = -1
  for (const [index, point] of points.entries()) {
    const distance = (point[0] - origin[0]) ** 2 + (point[1] - origin[1]) ** 2
    if (distance > bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/**
 * Упрощает контур.
 *
 * На крупном зуме возвращаются исходные координаты: там важна каждая вершина.
 * Гарантии результата: концы линии сохраняются, замкнутое кольцо остаётся
 * замкнутым, а при вырожденном результате (меньше трёх точек) возвращается
 * исходный контур — лучше показать лишнее, чем потерять фигуру.
 */
export const simplifyRing = ({
  coordinates,
  zoom,
  tolerancePx = SIMPLIFY_TOLERANCE_PX,
}: {
  coordinates: readonly Point[]
  zoom: number
  tolerancePx?: number
}): Point[] => {
  if (zoom > SIMPLIFY_MAX_ZOOM) return [...coordinates]
  if (coordinates.length < MIN_POINTS) return [...coordinates]

  const projected = coordinates.map((point) => toWorldPixels(point, zoom))
  const closed = isClosed(coordinates)

  if (!closed) {
    const kept = keepIndices(projected, tolerancePx)
    return kept.length < 2 ? [...coordinates] : kept.map((index) => coordinates[index])
  }

  // Кольцо разрываем в самой дальней вершине и упрощаем две половины отдельно.
  const breakAt = farthestFrom(projected, projected[0])
  if (breakAt === 0) return [...coordinates]

  const rotated = [...projected.slice(breakAt), ...projected.slice(0, breakAt), projected[breakAt]]
  const rotatedCoords = [
    ...coordinates.slice(breakAt),
    ...coordinates.slice(0, breakAt),
    coordinates[breakAt],
  ]

  const kept = keepIndices(rotated, tolerancePx)
  if (kept.length < 3) return [...coordinates]

  const result = kept.map((index) => rotatedCoords[index])
  // Замыкание восстанавливаем: кольцо должно остаться кольцом.
  const first = result[0]
  const last = result[result.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) result.push([first[0], first[1]])
  return result
}
