import { describe, expect, it } from 'vitest'
import { processFile } from '@/lib/converters'
import { ERR_SHAPEFILE, isProcessingError, type ProcessingError } from '@/lib/errors'
import {
  createGeoJsonZipBuffer,
  readGeoJsonFixture,
  readGeoJsonFixtureBuffer,
} from '../fixtures/geojson_fixtures'

const expectGeoJsonProcessingError = async (
  run: () => Promise<unknown>,
  messageIncludes: string,
): Promise<void> => {
  try {
    await run()
    expect.fail('Ожидалась ProcessingError')
  } catch (error) {
    expect(isProcessingError(error)).toBe(true)
    expect((error as ProcessingError).code).toBe(ERR_SHAPEFILE)
    expect((error as ProcessingError).message).toContain(messageIncludes)
  }
}

describe('processFile: GeoJSON', () => {
  it('конвертирует Point Feature в точку [lon, lat]', async () => {
    const result = await processFile({
      name: 'point.geojson',
      buffer: readGeoJsonFixtureBuffer('point.geojson'),
    })

    const points = Object.values(result.points)
    expect(points).toHaveLength(1)
    expect(points[0]?.coords).toEqual([37.6176, 55.7558])
    expect(points[0]?.desc).toBe('Кремль')
  })

  it('конвертирует LineString в пути', async () => {
    const result = await processFile({
      name: 'line.geojson',
      buffer: readGeoJsonFixtureBuffer('line.geojson'),
    })

    const paths = Object.values(result.paths)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.[0]).toEqual([37.6, 55.75])
  })

  it('конвертирует Polygon в пути', async () => {
    const result = await processFile({
      name: 'polygon.geojson',
      buffer: readGeoJsonFixtureBuffer('polygon.geojson'),
    })

    expect(Object.values(result.paths).length).toBeGreaterThan(0)
  })

  it('конвертирует FeatureCollection', async () => {
    const result = await processFile({
      name: 'feature_collection.geojson',
      buffer: readGeoJsonFixtureBuffer('feature_collection.geojson'),
    })

    expect(Object.values(result.points)).toHaveLength(2)
  })

  it('конвертирует Geometry на корне (нормализация в Feature)', async () => {
    const result = await processFile({
      name: 'geometry_root.geojson',
      buffer: readGeoJsonFixtureBuffer('geometry_root.geojson'),
    })

    expect(Object.values(result.points)).toHaveLength(1)
    expect(Object.values(result.points)[0]?.coords).toEqual([37.5, 55.5])
  })

  it('конвертирует GeoJSON из ZIP', async () => {
    const buffer = await createGeoJsonZipBuffer('data.geojson', readGeoJsonFixture('point.geojson'))
    const result = await processFile({ name: 'map.zip', buffer })

    expect(Object.values(result.points)).toHaveLength(1)
  })

  it('отклоняет GeoJSON с crs', async () => {
    await expectGeoJsonProcessingError(
      () =>
        processFile({
          name: 'with_crs.geojson',
          buffer: readGeoJsonFixtureBuffer('with_crs.geojson'),
        }),
      'crs',
    )
  })

  it('отклоняет пустой FeatureCollection', async () => {
    await expectGeoJsonProcessingError(
      () =>
        processFile({
          name: 'empty_features.geojson',
          buffer: readGeoJsonFixtureBuffer('empty_features.geojson'),
        }),
      'не содержит геометрии',
    )
  })

  it('отклоняет невалидный LineString', async () => {
    await expectGeoJsonProcessingError(
      () =>
        processFile({
          name: 'invalid_linestring.geojson',
          buffer: readGeoJsonFixtureBuffer('invalid_linestring.geojson'),
        }),
      'минимум 2 позиции',
    )
  })
})
