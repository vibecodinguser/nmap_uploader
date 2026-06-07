import { describe, expect, it } from 'vitest'
import { processFile } from '@/lib/converters'
import { ERR_SHAPEFILE, isProcessingError, type ProcessingError } from '@/lib/errors'
import { createKmzBuffer, readKmlFixture, readKmlFixtureBuffer } from '../fixtures/kml_fixtures'

const expectKmlProcessingError = async (
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

describe('processFile: KML/KMZ', () => {
  it('конвертирует Point Placemark в точку [lon, lat]', async () => {
    const result = await processFile({
      name: 'point.kml',
      buffer: readKmlFixtureBuffer('point.kml'),
    })

    const points = Object.values(result.points)
    expect(points).toHaveLength(1)
    expect(points[0]?.coords).toEqual([37.6176, 55.7558])
    expect(points[0]?.desc).toBe('Кремль')
  })

  it('конвертирует LineString в пути', async () => {
    const result = await processFile({
      name: 'line.kml',
      buffer: readKmlFixtureBuffer('line.kml'),
    })

    const paths = Object.values(result.paths)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.[0]).toEqual([37.6, 55.75])
  })

  it('конвертирует Polygon в пути', async () => {
    const result = await processFile({
      name: 'polygon.kml',
      buffer: readKmlFixtureBuffer('polygon.kml'),
    })

    expect(Object.values(result.paths).length).toBeGreaterThan(0)
  })

  it('конвертирует KMZ с doc.kml', async () => {
    const buffer = await createKmzBuffer('doc.kml', readKmlFixture('point.kml'))
    const result = await processFile({ name: 'map.kmz', buffer })

    expect(Object.values(result.points)).toHaveLength(1)
  })

  it('конвертирует KML из ZIP-архива', async () => {
    const { createZipBuffer } = await import('../fixtures/shapefile_fixtures')
    const buffer = await createZipBuffer({ 'route.kml': readKmlFixture('line.kml') })
    const result = await processFile({ name: 'routes.zip', buffer })

    expect(Object.values(result.paths).length).toBeGreaterThan(0)
  })

  it('отклоняет KMZ без KML', async () => {
    const { createZipBuffer } = await import('../fixtures/shapefile_fixtures')
    const buffer = await createZipBuffer({ 'readme.txt': 'no kml' })

    await expectKmlProcessingError(
      () => processFile({ name: 'empty.kmz', buffer }),
      'В KMZ-архиве отсутствует KML-файл',
    )
  })

  it('отклоняет KML без геометрии', async () => {
    await expectKmlProcessingError(
      () =>
        processFile({
          name: 'empty.kml',
          buffer: readKmlFixtureBuffer('metadata_only.kml'),
        }),
      'не содержит геометрии',
    )
  })

  it('отклоняет битый XML', async () => {
    await expectKmlProcessingError(
      () =>
        processFile({
          name: 'broken.kml',
          buffer: new TextEncoder().encode('<kml><Placemark>').buffer,
        }),
      'Ошибка чтения XML',
    )
  })
})
