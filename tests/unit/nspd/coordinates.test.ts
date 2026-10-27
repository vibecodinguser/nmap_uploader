import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import {
  isMercatorCoordinate,
  mercatorToWgs84,
  normalizeCoordinatesToWgs84,
  normalizeFeatureCollectionToWgs84,
  wgs84ToMercator,
} from '@/lib/nspd/coordinates'

describe('NSPD coordinates', () => {
  it('корректно преобразует координаты между WGS84 и Web Mercator', () => {
    const lon = 37.6173
    const lat = 55.7558

    const [x, y] = wgs84ToMercator(lon, lat)
    expect(x).toBeGreaterThan(4_000_000)
    expect(y).toBeGreaterThan(7_000_000)

    const [roundLon, roundLat] = mercatorToWgs84(x, y)
    expect(roundLon).toBeCloseTo(lon, 4)
    expect(roundLat).toBeCloseTo(lat, 4)
  })

  it('определяет метрические координаты Mercator', () => {
    expect(isMercatorCoordinate(4431691.24, 5651590.72)).toBe(true)
    expect(isMercatorCoordinate(39.81, 45.18)).toBe(false)
  })

  it('нормализует координаты полигона из Mercator в WGS84', () => {
    const mercatorRing = [
      [4431691.24, 5651590.72],
      [4431791.24, 5651690.72],
      [4431791.24, 5651590.72],
      [4431691.24, 5651590.72],
    ]

    const normalized = normalizeCoordinatesToWgs84([mercatorRing]) as number[][][]
    expect(normalized[0][0][0]).toBeCloseTo(39.8105, 3)
    expect(normalized[0][0][1]).toBeCloseTo(45.1907, 3)
  })

  it('нормализует координаты всей FeatureCollection', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [4431691.24, 5651590.72],
                [4431791.24, 5651690.72],
                [4431791.24, 5651590.72],
                [4431691.24, 5651590.72],
              ],
            ],
          },
          properties: { id: 1 },
        },
      ],
    }

    const converted = normalizeFeatureCollectionToWgs84(fc)
    const ring = (converted.features[0].geometry as any).coordinates[0]
    expect(ring[0][0]).toBeLessThan(180)
    expect(ring[0][1]).toBeLessThan(90)
  })
})
