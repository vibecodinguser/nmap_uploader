import { describe, expect, it } from 'vitest'
import {
  CLUSTER_MAX_ZOOM,
  type ClusterPoint,
  clusterPoints,
  toWorldPixels,
} from '@/lib/notes_layer/clustering'

/**
 * Кластеризация — чистая функция, поэтому проверяется без карты: спорные
 * решения (радиус, порог зума, стабильность ключа) видно прямо здесь.
 */
const at = (id: string, lon: number, lat: number): ClusterPoint => ({
  id,
  coordinates: [lon, lat],
})

describe('проекция', () => {
  it('центр мира в мировых пикселях посередине', () => {
    const [x, y] = toWorldPixels([0, 0], 0)

    expect(x).toBe(128)
    expect(y).toBe(128)
  })

  it('каждый зум удваивает масштаб', () => {
    const [x0] = toWorldPixels([10, 0], 0)
    const [x1] = toWorldPixels([10, 0], 1)

    expect(x1).toBeCloseTo(x0 * 2, 6)
  })

  it('широта за пределом Меркатора обрезается, а не улетает в бесконечность', () => {
    const [, y] = toWorldPixels([0, 89], 5)

    expect(Number.isFinite(y)).toBe(true)
  })
})

describe('объединение точек', () => {
  it('пустой список даёт пустой результат', () => {
    expect(clusterPoints({ points: [], zoom: 10 })).toEqual([])
  })

  it('близкие точки на малом зуме сливаются в один кластер', () => {
    const clusters = clusterPoints({
      points: [at('a', 37.6, 55.7), at('b', 37.6001, 55.7001)],
      zoom: 10,
    })

    expect(clusters).toHaveLength(1)
    expect(clusters[0].noteIds).toEqual(['a', 'b'])
  })

  it('далёкие точки остаются разными кластерами', () => {
    const clusters = clusterPoints({
      points: [at('a', 37.6, 55.7), at('b', 39.6, 57.7)],
      zoom: 10,
    })

    expect(clusters).toHaveLength(2)
    expect(clusters.every((cluster) => cluster.noteIds.length === 1)).toBe(true)
  })

  it('на крупном зуме точки не объединяются', () => {
    const points = [at('a', 37.6, 55.7), at('b', 37.6001, 55.7001)]

    const clusters = clusterPoints({ points, zoom: CLUSTER_MAX_ZOOM + 1 })

    expect(clusters).toHaveLength(2)
    expect(clusters.map((cluster) => cluster.noteIds[0])).toEqual(['a', 'b'])
  })

  it('на пороговом зуме объединение ещё работает', () => {
    const clusters = clusterPoints({
      points: [at('a', 37.6, 55.7), at('b', 37.6001, 55.7001)],
      zoom: CLUSTER_MAX_ZOOM,
    })

    expect(clusters).toHaveLength(1)
  })

  it('центр кластера — среднее по координатам', () => {
    const [cluster] = clusterPoints({
      points: [at('a', 37.6, 55.7), at('b', 37.6002, 55.7002)],
      zoom: 10,
    })

    expect(cluster.coordinates[0]).toBeCloseTo(37.6001, 6)
    expect(cluster.coordinates[1]).toBeCloseTo(55.7001, 6)
  })

  it('радиус можно расширить: тогда слипается больше', () => {
    const points = [at('a', 37.6, 55.7), at('b', 37.61, 55.71)]

    expect(clusterPoints({ points, zoom: 14 })).toHaveLength(2)
    expect(clusterPoints({ points, zoom: 14, radiusPx: 400 })).toHaveLength(1)
  })
})

describe('цепочка плотных точек', () => {
  it('точки вдоль линии собираются в один кластер', () => {
    // Соседние точки ближе радиуса друг к другу, но первая и последняя — нет.
    const points = Array.from({ length: 5 }, (_, index) =>
      at(`n${index}`, 37.6 + index * 0.0002, 55.7),
    )

    const clusters = clusterPoints({ points, zoom: 14 })

    expect(clusters).toHaveLength(1)
    expect(clusters[0].noteIds).toHaveLength(5)
  })
})

describe('стабильность ключа', () => {
  it('порядок входа не меняет id кластера', () => {
    const forward = clusterPoints({
      points: [at('a', 37.6, 55.7), at('b', 37.6001, 55.7001)],
      zoom: 10,
    })
    const backward = clusterPoints({
      points: [at('b', 37.6001, 55.7001), at('a', 37.6, 55.7)],
      zoom: 10,
    })

    expect(forward[0].id).toBe(backward[0].id)
  })

  it('изменение состава даёт другой id', () => {
    const two = clusterPoints({
      points: [at('a', 37.6, 55.7), at('b', 37.6001, 55.7001)],
      zoom: 10,
    })
    const three = clusterPoints({
      points: [at('a', 37.6, 55.7), at('b', 37.6001, 55.7001), at('c', 37.6002, 55.7002)],
      zoom: 10,
    })

    expect(two[0].id).not.toBe(three[0].id)
  })

  it('одиночная точка получает свой id без префикса кластера', () => {
    const [cluster] = clusterPoints({ points: [at('only', 37.6, 55.7)], zoom: 10 })

    expect(cluster.id).toBe('only')
    expect(cluster.noteIds).toEqual(['only'])
  })

  it('id кластера короткий даже при большом составе', () => {
    const points = Array.from({ length: 500 }, (_, index) =>
      at(`note-${index}-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, 37.6 + index * 0.00001, 55.7),
    )

    const [cluster] = clusterPoints({ points, zoom: 5 })

    expect(cluster.noteIds).toHaveLength(500)
    expect(cluster.id.length).toBeLessThan(24)
  })
})

describe('нагрузка', () => {
  it('пять тысяч точек считаются без квадратичного перебора', () => {
    const points = Array.from({ length: 5000 }, (_, index) =>
      at(`n${index}`, 37 + (index % 100) * 0.01, 55 + Math.floor(index / 100) * 0.01),
    )

    const started = performance.now()
    const clusters = clusterPoints({ points, zoom: 8 })
    const elapsed = performance.now() - started

    // Все точки в одном наборе должны быть распределены, а не потеряны.
    expect(clusters.reduce((sum, cluster) => sum + cluster.noteIds.length, 0)).toBe(5000)
    // Сетка даёт линейный проход; квадратичный перебор на этих данных — секунды.
    expect(elapsed).toBeLessThan(500)
  })
})
