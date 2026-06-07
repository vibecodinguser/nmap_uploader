import { describe, expect, it } from 'vitest'
import { encodeBinaryPayload, normalizeBinaryBuffer } from '@/lib/binary_buffer'
import { processFile } from '@/lib/converters'
import { ERR_SHAPEFILE, isProcessingError, ProcessingError } from '@/lib/errors'
import { createZipBuffer, readShapefileFixture } from '../fixtures/shapefile_fixtures'

const expectShapefileError = async (
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

describe('processFile: shapefile в ZIP', () => {
  it('конвертирует point shapefile в точку с координатами [lon, lat]', async () => {
    const result = await processFile({
      name: 'point_shapefile.zip',
      buffer: readShapefileFixture('point_shapefile.zip'),
    })

    const points = Object.values(result.points)
    expect(points).toHaveLength(1)
    expect(points[0]?.coords).toEqual([37.6176, 55.7558])
    expect(points[0]?.desc).toBe('Kreml')
    expect(result.metadata).toContain('Kreml')

    const paths = Object.values(result.paths)
    expect(paths).toHaveLength(1)
    expect(paths[0]).toEqual([[37.6176, 55.7558]])
  })

  it('конвертирует polygon shapefile (Shape Type 5) в пути', async () => {
    const result = await processFile({
      name: 'poly_shapefile.zip',
      buffer: readShapefileFixture('poly_shapefile.zip'),
    })

    const paths = Object.values(result.paths)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.[0]).toEqual([37.6, 55.75])
    expect(paths[0]?.at(-1)).toEqual([37.6, 55.75])
  })

  it('конвертирует multipoint shapefile (Shape Type 8)', async () => {
    const result = await processFile({
      name: 'mpoint_shapefile.zip',
      buffer: readShapefileFixture('mpoint_shapefile.zip'),
    })

    expect(
      Object.keys(result.points).length + Object.values(result.paths).flat().length,
    ).toBeGreaterThan(2)
  })

  it('конвертирует shapefile с Null Shape и Point в одном наборе', async () => {
    const result = await processFile({
      name: 'mixed_shapefile.zip',
      buffer: readShapefileFixture('mixed_shapefile.zip'),
    })

    const points = Object.values(result.points)
    expect(points).toHaveLength(1)
    expect(points[0]?.coords).toEqual([37.6176, 55.7558])
  })

  it('конвертирует polyline shapefile в пути', async () => {
    const result = await processFile({
      name: 'line_shapefile.zip',
      buffer: readShapefileFixture('line_shapefile.zip'),
    })

    const paths = Object.values(result.paths)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.length).toBeGreaterThan(1)
    expect(paths[0]?.[0]).toEqual([37.6, 55.75])
  })

  it('отклоняет пустой shapefile без геометрии', async () => {
    await expectShapefileError(
      () =>
        processFile({
          name: 'empty_shapefile.zip',
          buffer: readShapefileFixture('empty_shapefile.zip'),
        }),
      'Shapefile пуст',
    )
  })

  it('отклоняет ZIP без поддерживаемых геофайлов', async () => {
    const buffer = await createZipBuffer({ 'readme.txt': 'no geometry here' })

    await expectShapefileError(
      () => processFile({ name: 'unsupported.zip', buffer }),
      'ZIP не содержит поддерживаемых файлов',
    )
  })

  it('отклоняет пустой ZIP-архив', async () => {
    const buffer = await createZipBuffer({})

    await expectShapefileError(() => processFile({ name: 'empty.zip', buffer }), 'ZIP-архив пуст')
  })

  it('отклоняет битый ZIP-архив', async () => {
    const buffer = new TextEncoder().encode('not-a-zip').buffer

    await expectShapefileError(
      () => processFile({ name: 'broken.zip', buffer }),
      'Ошибка чтения ZIP-файла',
    )
  })

  it('отклоняет ZIP только с .shp без .shx/.dbf (нарушение ESRI spec)', async () => {
    const buffer = await createZipBuffer({ 'broken.shp': 'not-a-real-shapefile' })

    await expectShapefileError(
      () => processFile({ name: 'corrupt_shapefile.zip', buffer }),
      'Отсутствует индексный файл .shx',
    )
  })

  it('отклоняет ZIP с .shp/.shx/.dbf, но с повреждённым содержимым', async () => {
    const source = await (async () => {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(readShapefileFixture('point_shapefile.zip'))
      return {
        shp: (await zip.file('point.shp')?.async('uint8array')) ?? new Uint8Array(),
        shx: (await zip.file('point.shx')?.async('uint8array')) ?? new Uint8Array(),
        dbf: (await zip.file('point.dbf')?.async('uint8array')) ?? new Uint8Array(),
      }
    })()
    const brokenShp = new Uint8Array(source.shp)
    brokenShp[0] = 0
    brokenShp[1] = 0
    brokenShp[2] = 0
    brokenShp[3] = 0

    const buffer = await createZipBuffer({
      'point.shp': brokenShp,
      'point.shx': source.shx,
      'point.dbf': source.dbf,
    })

    await expectShapefileError(
      () => processFile({ name: 'corrupt_shapefile.zip', buffer }),
      'Некорректный File Code в .shp',
    )
  })

  it('принимает shapefile, переданный как base64 payload', async () => {
    const source = readShapefileFixture('point_shapefile.zip')
    const payload = encodeBinaryPayload(source)

    const result = await processFile({
      name: 'point_shapefile.zip',
      buffer: normalizeBinaryBuffer(payload),
    })

    const points = Object.values(result.points)
    expect(points).toHaveLength(1)
    expect(points[0]?.coords).toEqual([37.6176, 55.7558])
  })
})

describe('normalizeBinaryBuffer: shapefile payload', () => {
  it('отклоняет пустой payload', () => {
    expect(() => normalizeBinaryBuffer(null)).toThrow(ProcessingError)
    expect(() => normalizeBinaryBuffer(null)).toThrow('Пустой файл')
  })

  it('отклоняет некорректный base64', () => {
    expect(() => normalizeBinaryBuffer('%%%not-base64%%%')).toThrow(ProcessingError)
    expect(() => normalizeBinaryBuffer('%%%not-base64%%%')).toThrow(
      'Некорректные бинарные данные файла (base64)',
    )
  })
})
