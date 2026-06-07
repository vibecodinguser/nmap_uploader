import { describe, expect, it } from 'vitest'
import { processFile } from '@/lib/converters'
import { ERR_SHAPEFILE, isProcessingError, type ProcessingError } from '@/lib/errors'
import { createWktZipBuffer, readWktFixture, readWktFixtureBuffer } from '../fixtures/wkt_fixtures'

const expectWktProcessingError = async (
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

describe('processFile: WKT geometry', () => {
  it('конвертирует POINT в точку [lon, lat]', async () => {
    const result = await processFile({
      name: 'point.wkt',
      buffer: readWktFixtureBuffer('point.wkt'),
    })

    const points = Object.values(result.points)
    expect(points).toHaveLength(1)
    expect(points[0]?.coords).toEqual([37.6176, 55.7558])
  })

  it('конвертирует LINESTRING в пути', async () => {
    const result = await processFile({
      name: 'line.wkt',
      buffer: readWktFixtureBuffer('line.wkt'),
    })

    const paths = Object.values(result.paths)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.[0]).toEqual([37.6, 55.75])
  })

  it('конвертирует POLYGON в пути', async () => {
    const result = await processFile({
      name: 'polygon.wkt',
      buffer: readWktFixtureBuffer('polygon.wkt'),
    })

    expect(Object.values(result.paths).length).toBeGreaterThan(0)
  })

  it('конвертирует WKT из ZIP-архива', async () => {
    const buffer = await createWktZipBuffer('line.wkt', readWktFixture('line.wkt'))
    const result = await processFile({ name: 'lines.zip', buffer })
    expect(Object.values(result.paths).length).toBeGreaterThan(0)
  })

  it('отклоняет CRS WKT2 GEOGCRS', async () => {
    await expectWktProcessingError(
      () =>
        processFile({
          name: 'crs.wkt',
          buffer: readWktFixtureBuffer('crs_geogcrs.wkt'),
        }),
      'CRS WKT (GEOGCRS)',
    )
  })

  it('отклоняет пустой WKT-файл', async () => {
    await expectWktProcessingError(
      () =>
        processFile({
          name: 'empty.wkt',
          buffer: new TextEncoder().encode('# только комментарий\n').buffer,
        }),
      'не содержит строк с геометрией',
    )
  })

  it('отклоняет битый WKT', async () => {
    await expectWktProcessingError(
      () =>
        processFile({
          name: 'broken.wkt',
          buffer: new TextEncoder().encode('POINT (37 55').buffer,
        }),
      'Не удалось разобрать геометрию WKT',
    )
  })
})
