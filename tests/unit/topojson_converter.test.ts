import { describe, expect, it } from 'vitest'
import { processFile } from '@/lib/converters'
import { ERR_SHAPEFILE, isProcessingError, type ProcessingError } from '@/lib/errors'
import {
  createTopoJsonZipBuffer,
  readTopoJsonFixture,
  readTopoJsonFixtureBuffer,
} from '../fixtures/topojson_fixtures'

const expectTopoJsonProcessingError = async (
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

describe('processFile: TopoJSON', () => {
  it('конвертирует Point в точку [lon, lat]', async () => {
    const result = await processFile({
      name: 'point_topo.topojson',
      buffer: readTopoJsonFixtureBuffer('point_topo.topojson'),
    })

    const points = Object.values(result.points)
    expect(points).toHaveLength(1)
    expect(points[0]?.coords).toEqual([37.6176, 55.7558])
    expect(points[0]?.desc).toBe('Кремль')
  })

  it('конвертирует пример из спецификации (Point, LineString, Polygon)', async () => {
    const result = await processFile({
      name: 'example.topojson',
      buffer: readTopoJsonFixtureBuffer('example.topojson'),
    })

    expect(Object.values(result.points).length).toBeGreaterThan(0)
    expect(Object.values(result.paths).length).toBeGreaterThan(0)
  })

  it('конвертирует квантованный TopoJSON с transform', async () => {
    const result = await processFile({
      name: 'quantized.topojson',
      buffer: readTopoJsonFixtureBuffer('quantized.topojson'),
    })

    expect(Object.values(result.paths).length).toBeGreaterThan(0)
    expect(Object.values(result.points).length).toBeGreaterThan(0)
  })

  it('конвертирует TopoJSON из ZIP', async () => {
    const buffer = await createTopoJsonZipBuffer(
      'data.topojson',
      readTopoJsonFixture('point_topo.topojson'),
    )
    const result = await processFile({ name: 'map.zip', buffer })

    expect(Object.values(result.points)).toHaveLength(1)
  })

  it('отклоняет пустой objects', async () => {
    await expectTopoJsonProcessingError(
      () =>
        processFile({
          name: 'empty_objects.topojson',
          buffer: readTopoJsonFixtureBuffer('empty_objects.topojson'),
        }),
      'objects',
    )
  })

  it('отклоняет arc с одной позицией', async () => {
    await expectTopoJsonProcessingError(
      () =>
        processFile({
          name: 'invalid_arc.topojson',
          buffer: readTopoJsonFixtureBuffer('invalid_arc.topojson'),
        }),
      'минимум 2 позиции',
    )
  })

  it('отклоняет неверный arc index', async () => {
    await expectTopoJsonProcessingError(
      () =>
        processFile({
          name: 'invalid_arc_index.topojson',
          buffer: readTopoJsonFixtureBuffer('invalid_arc_index.topojson'),
        }),
      'вне диапазона',
    )
  })
})
