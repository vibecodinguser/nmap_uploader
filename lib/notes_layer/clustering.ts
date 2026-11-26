/**
 * Кластеризация точек на дальних зумах.
 *
 * Свой расчёт, а не `ymaps.Clusterer`: модуль кластеризации в сборке редактора
 * может отсутствовать, а его поведение нельзя проверить юнит-тестами. Здесь
 * чистая функция: на вход — точки и зум, на выход — группы, которые надо
 * нарисовать одним значком.
 *
 * Точки объединяются, если на экране они ближе `CLUSTER_RADIUS_PX`. Поэтому
 * расчёт идёт в мировых пикселях проекции Меркатора: в них расстояние на
 * экране — это просто разность координат.
 */

/** Кластер: одна точка на карте вместо нескольких заметок. */
export type NoteCluster = {
  /** Стабильный ключ: по нему объект переиспользуется при перерисовке. */
  id: string
  /** Координаты центра — среднее по заметкам кластера. */
  coordinates: [number, number]
  noteIds: string[]
}

export type ClusterPoint = {
  id: string
  coordinates: [number, number]
}

/** Радиус объединения на экране, в пикселях. */
export const CLUSTER_RADIUS_PX = 44

/** До какого зума точки объединяются: с 15 видно отдельные объекты. */
export const CLUSTER_MAX_ZOOM = 14

const TILE_SIZE = 256

/** Широта Меркатора ограничена: дальше проекция уходит в бесконечность. */
const MAX_LATITUDE = 85.051_128_78

/** Мировые пиксели в проекции Меркатора при данном зуме. */
export const toWorldPixels = ([lon, lat]: [number, number], zoom: number): [number, number] => {
  const scale = TILE_SIZE * 2 ** zoom
  const clamped = Math.max(Math.min(lat, MAX_LATITUDE), -MAX_LATITUDE)
  const radians = (clamped * Math.PI) / 180
  const x = ((lon + 180) / 360) * scale
  const y = ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale
  return [x, y]
}

/** Размер ячейки сетки: ровно радиус объединения, чтобы соседние ячейки попадали в проверку. */
const cellOf = ([x, y]: [number, number], cellSize: number): [number, number] => [
  Math.floor(x / cellSize),
  Math.floor(y / cellSize),
]

const cellKey = (x: number, y: number): string => `${x}:${y}`

/** Расстояние между точками в пикселях — после перевода в мировые пиксели. */
const distancePx = (left: [number, number], right: [number, number]): number =>
  Math.hypot(left[0] - right[0], left[1] - right[1])

/**
 * Объединяет точки в кластеры.
 *
 * Жадный проход по сетке, а не попарное сравнение: при 5 000 точках
 * квадратичный перебор — 25 млн сравнений на каждую перерисовку. Сетка делает
 * работу линейной по числу точек.
 *
 * Кластер расширяется, пока в него попадают новые точки: это даёт «цепочки»
 * вдоль плотной линии объектов, что для карты естественнее фиксированного
 * радиуса от первого элемента.
 */
export const clusterPoints = ({
  points,
  zoom,
  radiusPx = CLUSTER_RADIUS_PX,
}: {
  points: readonly ClusterPoint[]
  zoom: number
  radiusPx?: number
}): NoteCluster[] => {
  if (points.length === 0) return []
  // На крупном зуме объектов и так видно по отдельности — считаем не зря.
  if (zoom > CLUSTER_MAX_ZOOM) {
    return points.map((point) => ({
      id: point.id,
      coordinates: point.coordinates,
      noteIds: [point.id],
    }))
  }

  const pixelPoints = points.map((point) => ({
    point,
    pixel: toWorldPixels(point.coordinates, zoom),
  }))

  const grid = new Map<string, number[]>()
  for (const [index, entry] of pixelPoints.entries()) {
    const [cx, cy] = cellOf(entry.pixel, radiusPx)
    const key = cellKey(cx, cy)
    const bucket = grid.get(key)
    if (bucket) bucket.push(index)
    else grid.set(key, [index])
  }

  const assigned = new Set<number>()
  const clusters: NoteCluster[] = []

  for (const index of pixelPoints.keys()) {
    if (assigned.has(index)) continue

    assigned.add(index)
    const members = [index]
    // Очередь, а не рекурсия: цепочка плотных точек может быть длинной.
    const queue = [index]

    while (queue.length > 0) {
      const current = queue.pop() as number
      const base = pixelPoints[current].pixel
      const [cx, cy] = cellOf(base, radiusPx)

      // Соседние ячейки тоже проверяем: точка у границы ячейки видит соседей
      // только через них.
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const bucket = grid.get(cellKey(cx + dx, cy + dy))
          if (!bucket) continue
          for (const candidate of bucket) {
            if (assigned.has(candidate)) continue
            if (distancePx(base, pixelPoints[candidate].pixel) > radiusPx) continue
            assigned.add(candidate)
            members.push(candidate)
            queue.push(candidate)
          }
        }
      }
    }

    const coordinates = average(members.map((member) => pixelPoints[member].point.coordinates))
    const noteIds = members.map((member) => pixelPoints[member].point.id).sort()
    clusters.push({
      // Одиночная точка сохраняет свой id: тогда при перерисовке переиспользуется
      // её собственный объект, а не создаётся значок кластера из одного.
      //
      // Ключ кластера — из состава, а не из позиции: тот же набор точек даёт
      // тот же объект и не мерцает. Состав сворачивается в короткий хеш: у
      // кластера из тысяч точек склеенный список id весил бы десятки килобайт
      // на каждую перерисовку.
      id: noteIds.length === 1 ? noteIds[0] : `cluster:${shortHash(noteIds.join(','))}`,
      coordinates,
      noteIds,
    })
  }

  return clusters
}

/** Короткий хеш (FNV-1a) для ключа кластера. */
const shortHash = (value: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** Центр кластера: среднее по координатам. */
const average = (coordinates: readonly [number, number][]): [number, number] => {
  let lon = 0
  let lat = 0
  for (const [itemLon, itemLat] of coordinates) {
    lon += itemLon
    lat += itemLat
  }
  return [lon / coordinates.length, lat / coordinates.length]
}
