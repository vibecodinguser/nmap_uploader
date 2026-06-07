import { describe, expect, it } from 'vitest'
import { processFile } from '@/lib/converters'
import { ERR_SHAPEFILE, isProcessingError, type ProcessingError } from '@/lib/errors'
import { createGpxZipBuffer, readGpxFixture, readGpxFixtureBuffer } from '../fixtures/gpx_fixtures'

const expectGpxProcessingError = async (
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

describe('processFile: GPX 1.1', () => {
  it('конвертирует waypoint (wpt) в точку [lon, lat]', async () => {
    const result = await processFile({
      name: 'point.gpx',
      buffer: readGpxFixtureBuffer('point.gpx'),
    })

    const points = Object.values(result.points)
    expect(points).toHaveLength(1)
    expect(points[0]?.coords).toEqual([37.6176, 55.7558])
    expect(points[0]?.desc).toBe('Кремль')
    expect(result.metadata).toContain('Кремль')
  })

  it('конвертирует track (trk/trkseg/trkpt) в пути', async () => {
    const result = await processFile({
      name: 'track.gpx',
      buffer: readGpxFixtureBuffer('track.gpx'),
    })

    const paths = Object.values(result.paths)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.[0]).toEqual([37.6, 55.75])
    expect(paths[0]?.at(-1)).toEqual([37.64, 55.77])
  })

  it('конвертирует route (rte/rtept) в пути', async () => {
    const result = await processFile({
      name: 'route.gpx',
      buffer: readGpxFixtureBuffer('route.gpx'),
    })

    const paths = Object.values(result.paths)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.length).toBeGreaterThan(1)
  })

  it('конвертирует GPX из ZIP-архива', async () => {
    const buffer = await createGpxZipBuffer('track.gpx', readGpxFixture('track.gpx'))
    const result = await processFile({ name: 'track.zip', buffer })

    expect(Object.values(result.paths).length).toBeGreaterThan(0)
  })

  it('отклоняет GPX 1.0', async () => {
    const broken = readGpxFixture('point.gpx').replace('version="1.1"', 'version="1.0"')

    await expectGpxProcessingError(
      () => processFile({ name: 'old.gpx', buffer: new TextEncoder().encode(broken).buffer }),
      'Версия GPX должна быть 1.1',
    )
  })

  it('отклоняет GPX без геометрии', async () => {
    await expectGpxProcessingError(
      () =>
        processFile({
          name: 'empty.gpx',
          buffer: readGpxFixtureBuffer('metadata_only.gpx'),
        }),
      'не содержит waypoints',
    )
  })

  it('отклоняет битый XML', async () => {
    await expectGpxProcessingError(
      () =>
        processFile({
          name: 'broken.gpx',
          buffer: new TextEncoder().encode('<gpx version="1.1" creator="x"><wpt').buffer,
        }),
      'Ошибка чтения XML',
    )
  })

  it('отклоняет координаты вне WGS84', async () => {
    const broken = readGpxFixture('point.gpx').replace('lat="55.7558"', 'lat="95.0"')

    await expectGpxProcessingError(
      () => processFile({ name: 'bad.gpx', buffer: new TextEncoder().encode(broken).buffer }),
      'вне диапазона [-90, 90]',
    )
  })
})
