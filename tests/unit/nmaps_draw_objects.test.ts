import { describe, expect, it, vi } from 'vitest'
import {
  createDrawMapObjectsDetail,
  createDrawMapObjectsFromNmapIndex,
  createPolygonSnapTarget,
  createPolygonSnapTargets,
  loadDrawMapObjectsForDate,
  type MapObjectLike,
  parseDrawMapObjectsDetail,
} from '@/lib/nmaps_draw_objects'

describe('nmaps_draw_objects', () => {
  const polygon: MapObjectLike = {
    id: 'polygon-1',
    geomType: 'Polygon',
    geomCoords: [
      [37.6, 55.7],
      [37.7, 55.7],
      [37.7, 55.8],
      [37.6, 55.7],
    ],
  }

  it('преобразует index.json в объекты карты и цели всех полигонов', () => {
    expect(
      createDrawMapObjectsFromNmapIndex(
        {
          points: {
            polygon: { coords: [37.6, 55.7], desc: 'Полигон' },
            line: { coords: [38.6, 56.7], desc: 'Линия' },
          },
          paths: {
            polygon: [
              [37.6, 55.7],
              [37.7, 55.7],
              [37.7, 55.8],
              [37.6, 55.7],
            ],
            line: [
              [38.6, 56.7],
              [38.7, 56.7],
            ],
          },
        },
        '01-01-2025',
      ),
    ).toEqual({
      points: [
        expect.objectContaining({ id: 'polygon', date: '01-01-2025', geomType: 'Polygon' }),
        expect.objectContaining({ id: 'line', date: '01-01-2025', geomType: 'LineString' }),
      ],
      snapTargets: [
        {
          id: 'polygon',
          coordinates: [
            [37.6, 55.7],
            [37.7, 55.7],
            [37.7, 55.8],
            [37.6, 55.7],
          ],
        },
      ],
    })
  })

  it('загружает цели по сохранённой дате без монтирования панели', async () => {
    const downloadIndex = vi.fn().mockResolvedValue({
      points: {
        polygon: { coords: [37.6, 55.7], desc: 'Полигон' },
      },
      paths: {
        polygon: [
          [37.6, 55.7],
          [37.7, 55.7],
          [37.7, 55.8],
          [37.6, 55.7],
        ],
      },
    })

    const detail = await loadDrawMapObjectsForDate({
      selectedDate: '01-01-2025',
      token: 'token',
      downloadIndex,
    })

    expect(downloadIndex).toHaveBeenCalledWith({ token: 'token', targetDate: '2025-01-01' })
    expect(detail.snapTargets).toEqual([expect.objectContaining({ id: 'polygon' })])
  })

  it('создаёт цель только для валидного полигона', () => {
    expect(createPolygonSnapTarget(polygon)).toEqual({
      id: 'polygon-1',
      coordinates: polygon.geomCoords,
    })
    expect(createPolygonSnapTarget({ ...polygon, geomType: 'LineString' })).toBeNull()
    expect(createPolygonSnapTarget({ ...polygon, geomCoords: [[37.6, 55.7]] })).toBeNull()
  })

  it('отклоняет полигон менее чем с тремя уникальными вершинами', () => {
    expect(
      createPolygonSnapTarget({
        ...polygon,
        geomCoords: [
          [37.6, 55.7],
          [37.7, 55.7],
          [37.6, 55.7],
        ],
      }),
    ).toBeNull()
  })

  it('замыкает валидный контур ровно один раз', () => {
    expect(
      parseDrawMapObjectsDetail({
        points: [],
        snapTargets: [
          {
            id: 'polygon',
            coordinates: [
              [37.6, 55.7],
              [37.7, 55.7],
              [37.7, 55.8],
            ],
          },
        ],
      })?.snapTargets[0]?.coordinates,
    ).toEqual([
      [37.6, 55.7],
      [37.7, 55.7],
      [37.7, 55.8],
      [37.6, 55.7],
    ])
  })

  it('не дублирует замыкающую точку', () => {
    expect(createPolygonSnapTarget(polygon)?.coordinates).toEqual(polygon.geomCoords)
  })

  it('создаёт цели для всех валидных полигонов в порядке заметок', () => {
    expect(
      createPolygonSnapTargets([
        polygon,
        {
          id: 'line',
          geomType: 'LineString',
          geomCoords: [
            [0, 0],
            [1, 1],
          ],
        },
        {
          id: 'polygon-2',
          geomType: 'Polygon',
          geomCoords: [
            [38, 56],
            [39, 56],
            [39, 57],
          ],
        },
        { id: 'invalid', geomType: 'Polygon', geomCoords: [[0, 0]] },
      ]),
    ).toEqual([
      { id: 'polygon-1', coordinates: polygon.geomCoords },
      {
        id: 'polygon-2',
        coordinates: [
          [38, 56],
          [39, 56],
          [39, 57],
          [38, 56],
        ],
      },
    ])
  })

  it('отбрасывает нечисловые координаты до проверки контура', () => {
    expect(
      parseDrawMapObjectsDetail({
        points: [],
        snapTargets: [
          {
            id: 'polygon',
            coordinates: [
              [37.6, 55.7],
              [Number.NaN, 55.8],
              [37.7, Number.POSITIVE_INFINITY],
            ],
          },
        ],
      }),
    ).toEqual({ points: [], snapTargets: [] })
  })

  it('валидирует detail после JSON-сериализации', () => {
    const detail = createDrawMapObjectsDetail([polygon], createPolygonSnapTargets([polygon]))
    expect(parseDrawMapObjectsDetail(JSON.stringify(detail))).toEqual(detail)
  })

  it('сбрасывает некорректные цели, сохраняя список объектов', () => {
    expect(
      parseDrawMapObjectsDetail({
        points: [polygon],
        snapTargets: [{ id: 1, coordinates: [] }],
      }),
    ).toEqual({ points: [polygon], snapTargets: [] })
  })

  it('отклоняет некорректный detail', () => {
    expect(parseDrawMapObjectsDetail('{')).toBeNull()
    expect(parseDrawMapObjectsDetail({ points: null })).toBeNull()
  })
})
