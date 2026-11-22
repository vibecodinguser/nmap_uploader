/**
 * Чистая геометрия разреза линии растительности.
 *
 * Растительность в Народной карте хранится как замкнутая в кольцо линия, а
 * «разрез» — это разбиение линии на части в выбранных точках. Части остаются
 * в том же объекте и стыкуются концами: материал между разрезами не удаляется.
 *
 * Здесь только числа. Проверка попадания клика живёт в пикселях карты
 * (`findNearestPointOnPolyline`), потому что допуск задаётся в пикселях, а сам
 * разрез — в географических координатах (`splitLineAtCut`): новая вершина
 * вставляется интерполяцией между соседними, без обратной проекции.
 */

/** Координаты линии: `[долгота, широта]`. */
export type LineCoordinates = number[][]

/** Точка в произвольной линейной плоскости (обычно глобальные пиксели карты). */
export type Point2 = [number, number]

/** Ближайшая к клику точка на линии. */
export type LineCut = {
  /** Индекс отрезка, на который попал клик. */
  segmentIndex: number
  /** Доля вдоль отрезка: 0 — начало, 1 — конец. */
  ratio: number
  /** Расстояние от клика до линии в тех же единицах, что и вход. */
  distance: number
}

/** Минимальное число вершин в части: часть из одной точки не редактируется. */
export const MIN_PART_POINTS = 2

/** Минимальная длина части в метрах: короче — это уже не часть, а обрубок. */
export const MIN_PART_LENGTH_METERS = 1

/** Насколько близко к вершине должен попасть разрез, чтобы не добавлять точку. */
export const VERTEX_SNAP_RATIO = 0.02

const SAME_POINT_EPS = 1e-12
const EARTH_RADIUS_METERS = 6_371_008.8

/** Две координаты — одна и та же точка (с поправкой на погрешность чисел). */
export const isSamePoint = (left: number[], right: number[], eps = SAME_POINT_EPS): boolean =>
  Math.abs(left[0] - right[0]) <= eps && Math.abs(left[1] - right[1]) <= eps

/** Кольцо замкнуто: первая и последняя точки совпадают. */
export const isClosedLine = (coords: LineCoordinates): boolean =>
  coords.length > 2 && isSamePoint(coords[0], coords[coords.length - 1])

/** Длина отрезка между двумя географическими точками в метрах. */
export const segmentLengthMeters = (from: number[], to: number[]): number => {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180
  const lat1 = toRadians(from[1])
  const lat2 = toRadians(to[1])
  const deltaLat = lat2 - lat1
  const deltaLon = toRadians(to[0] - from[0])
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

/** Длина всей линии в метрах. */
export const lineLengthMeters = (coords: LineCoordinates): number => {
  let total = 0
  for (let index = 1; index < coords.length; index += 1) {
    total += segmentLengthMeters(coords[index - 1], coords[index])
  }
  return total
}

/**
 * Ищет ближайшую к `target` точку ломаной.
 *
 * Вход и выход — в одной плоскости (глобальные пиксели карты), чтобы допуск
 * клика можно было задать в пикселях. У замкнутого кольца просматриваются все
 * отрезки, включая замыкающий: с началом совпадает только последняя точка, а
 * сам отрезок к ней — обычная сторона кольца.
 */
export const findNearestPointOnPolyline = (line: Point2[], target: Point2): LineCut | null => {
  if (line.length < 2) return null

  let best: LineCut | null = null

  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index]
    const end = line[index + 1]
    const deltaX = end[0] - start[0]
    const deltaY = end[1] - start[1]
    const lengthSquared = deltaX * deltaX + deltaY * deltaY

    let ratio = 0
    if (lengthSquared > 0) {
      ratio = ((target[0] - start[0]) * deltaX + (target[1] - start[1]) * deltaY) / lengthSquared
      ratio = Math.min(1, Math.max(0, ratio))
    }

    const pointX = start[0] + deltaX * ratio
    const pointY = start[1] + deltaY * ratio
    const distance = Math.hypot(target[0] - pointX, target[1] - pointY)

    if (!best || distance < best.distance) {
      best = { segmentIndex: index, ratio, distance }
    }
  }

  return best
}

/** Считает координаты разреза: существующая вершина или интерполяция по отрезку. */
const resolveCutPoint = (
  coords: LineCoordinates,
  cut: LineCut,
): { point: number[]; atVertex: number | null } => {
  const start = coords[cut.segmentIndex]
  const end = coords[cut.segmentIndex + 1]

  if (cut.ratio <= VERTEX_SNAP_RATIO) {
    return { point: start.slice(), atVertex: cut.segmentIndex }
  }
  if (cut.ratio >= 1 - VERTEX_SNAP_RATIO) {
    return { point: end.slice(), atVertex: cut.segmentIndex + 1 }
  }

  return {
    point: [start[0] + (end[0] - start[0]) * cut.ratio, start[1] + (end[1] - start[1]) * cut.ratio],
    atVertex: null,
  }
}

/**
 * Координаты точки разреза: существующая вершина или точка внутри отрезка.
 * Нужна, чтобы поставить точку разреза ровно там, куда попал клик.
 */
export const resolveCutCoordinates = (coords: LineCoordinates, cut: LineCut): number[] =>
  resolveCutPoint(coords, cut).point

/** Проверяет, что часть пригодна для правки: не короче лимита и не вырождена. */
const isValidPart = (
  part: LineCoordinates,
  minPoints: number,
  minLengthMeters: number,
): boolean => {
  if (part.length < minPoints) return false
  if (part.some((point) => !Array.isArray(point) || point.length < 2)) return false
  return lineLengthMeters(part) >= minLengthMeters
}

export type SplitLineOptions = {
  minPartPoints?: number
  minPartLengthMeters?: number
}

/** Делит линию от начала до конца на две части с общей точкой разреза. */
const splitOpenLine = (
  coords: LineCoordinates,
  cut: LineCut,
  point: number[],
  atVertex: number | null,
): LineCoordinates[] =>
  atVertex !== null
    ? [coords.slice(0, atVertex + 1), coords.slice(atVertex)]
    : [
        [...coords.slice(0, cut.segmentIndex + 1), point],
        [point, ...coords.slice(cut.segmentIndex + 1)],
      ]

/**
 * Разрезает линию в указанной точке.
 *
 * - Замкнутое кольцо остаётся одной линией, но теперь начинается и
 *   заканчивается в точке разреза: это первая граница будущих частей.
 *   Вторую ставит `splitRingInTwo`.
 * - Открытая линия делится на две части с общей точкой разреза.
 *
 * Возвращает `null`, если разрез невозможен: точка вне линии, получилась
 * вырожденная или слишком короткая часть.
 */
export const splitLineAtCut = (
  coords: LineCoordinates,
  cut: LineCut,
  options: SplitLineOptions = {},
): LineCoordinates[] | null => {
  const minPoints = options.minPartPoints ?? MIN_PART_POINTS
  const minLengthMeters = options.minPartLengthMeters ?? MIN_PART_LENGTH_METERS

  if (coords.length < 2) return null
  if (cut.segmentIndex < 0 || cut.segmentIndex >= coords.length - 1) return null

  const { point, atVertex } = resolveCutPoint(coords, cut)
  const closed = isClosedLine(coords)

  let parts: LineCoordinates[]

  if (closed) {
    const ring = coords.slice(0, -1)
    const vertexIndex = atVertex === null ? null : atVertex % ring.length
    if (vertexIndex === null) {
      // Разрез внутри отрезка: линия начинается и заканчивается в точке разреза.
      const head = ring.slice(cut.segmentIndex + 1)
      const tail = ring.slice(0, cut.segmentIndex + 1)
      parts = [[point, ...head, ...tail, point]]
    } else {
      const rotated = [...ring.slice(vertexIndex), ...ring.slice(0, vertexIndex)]
      parts = [[...rotated, rotated[0].slice()]]
    }
  } else {
    parts = splitOpenLine(coords, cut, point, atVertex)
  }

  if (!parts.every((part) => isValidPart(part, minPoints, minLengthMeters))) {
    return null
  }

  return parts
}

/**
 * Делит замкнутое кольцо на две части: от его начала до точки разреза и от
 * неё обратно к началу.
 *
 * Начало кольца считается уже поставленной границей, поэтому части стыкуются
 * в двух точках и контур остаётся замкнутым. Возвращает `null`, если линия не
 * замкнута, точка разреза совпала с началом или часть вышла слишком короткой.
 */
export const splitRingInTwo = (
  coords: LineCoordinates,
  cut: LineCut,
  options: SplitLineOptions = {},
): LineCoordinates[] | null => {
  const minPoints = options.minPartPoints ?? MIN_PART_POINTS
  const minLengthMeters = options.minPartLengthMeters ?? MIN_PART_LENGTH_METERS

  if (!isClosedLine(coords)) return null
  if (cut.segmentIndex < 0 || cut.segmentIndex >= coords.length - 1) return null

  const { point, atVertex } = resolveCutPoint(coords, cut)
  const parts = splitOpenLine(coords, cut, point, atVertex)

  if (!parts.every((part) => isValidPart(part, minPoints, minLengthMeters))) {
    return null
  }

  return parts
}
