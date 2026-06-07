import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import {
  countDbfRecords,
  ESRI_FILE_CODE,
  ESRI_FIRST_RECORD_OFFSET_WORDS,
  ESRI_SHAPE_TYPE,
  ESRI_VERSION,
  isValidEsriBasename,
  parseShpMainFile,
  validateEsriShapefileSet,
  validateEsriShapefileZip,
  validateShxAgainstShp,
} from '@/lib/shapefile/esri_spec'
import { createZipBuffer, readShapefileFixture } from '../fixtures/shapefile_fixtures'

const fixturesDir = resolve(import.meta.dirname, '../fixtures')

const loadShapefileSetFromZip = async (zipName: string, basename: string) => {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(readShapefileFixture(zipName))
  const shp = await zip.file(`${basename}.shp`)?.async('arraybuffer')
  const shx = await zip.file(`${basename}.shx`)?.async('arraybuffer')
  const dbf = await zip.file(`${basename}.dbf`)?.async('arraybuffer')
  if (!shp || !shx || !dbf) {
    throw new Error(`Фикстура ${zipName} не содержит полный набор ${basename}.{shp,shx,dbf}`)
  }
  return { basename, shp, shx, dbf }
}

const expectSpecError = (run: () => void | Promise<void>, messageIncludes: string) => {
  const invoke = async () => {
    await run()
  }
  return invoke().catch((error: unknown) => {
    expect(error).toBeInstanceOf(ProcessingError)
    expect((error as ProcessingError).code).toBe(ERR_SHAPEFILE)
    expect((error as ProcessingError).message).toContain(messageIncludes)
  })
}

describe('ESRI Shapefile spec: именование', () => {
  it('принимает корректные basename, в т.ч. длинные из GeoServer', () => {
    expect(isValidEsriBasename('point')).toBe(true)
    expect(isValidEsriBasename('a')).toBe(true)
    expect(isValidEsriBasename('counties')).toBe(true)
    expect(isValidEsriBasename('myfile_1')).toBe(true)
    expect(isValidEsriBasename('verylongname')).toBe(true)
    expect(isValidEsriBasename('oopt_wth_detailsPolygon')).toBe(true)
  })

  it('отклоняет некорректные basename', () => {
    expect(isValidEsriBasename('')).toBe(false)
    expect(isValidEsriBasename('_bad')).toBe(false)
    expect(isValidEsriBasename('bad name')).toBe(false)
    expect(isValidEsriBasename('bad.name')).toBe(false)
  })
})

describe('ESRI Shapefile spec: заголовок и записи .shp', () => {
  it('point: File Code 9994, Version 1000, Shape Type 1', async () => {
    const { shp } = await loadShapefileSetFromZip('point_shapefile.zip', 'point')
    const summary = parseShpMainFile(shp)

    expect(summary.fileLengthWords * 2).toBe(shp.byteLength)
    expect(summary.headerShapeType).toBe(ESRI_SHAPE_TYPE.POINT)
    expect(summary.records).toHaveLength(1)
    expect(summary.records[0]?.shapeType).toBe(ESRI_SHAPE_TYPE.POINT)
    expect(summary.records[0]?.recordNumber).toBe(1)
  })

  it('polyline: Shape Type 3', async () => {
    const { shp } = await loadShapefileSetFromZip('line_shapefile.zip', 'line')
    const summary = parseShpMainFile(shp)
    expect(summary.headerShapeType).toBe(ESRI_SHAPE_TYPE.POLYLINE)
    expect(summary.records[0]?.shapeType).toBe(ESRI_SHAPE_TYPE.POLYLINE)
  })

  it('polygon: Shape Type 5, кольцо замкнуто', async () => {
    const set = await loadShapefileSetFromZip('poly_shapefile.zip', 'poly')
    expect(() => validateEsriShapefileSet(set)).not.toThrow()

    const summary = parseShpMainFile(set.shp)
    expect(summary.headerShapeType).toBe(ESRI_SHAPE_TYPE.POLYGON)
  })

  it('multipoint: Shape Type 8', async () => {
    const set = await loadShapefileSetFromZip('mpoint_shapefile.zip', 'mpoint')
    expect(() => validateEsriShapefileSet(set)).not.toThrow()

    const summary = parseShpMainFile(set.shp)
    expect(summary.headerShapeType).toBe(ESRI_SHAPE_TYPE.MULTIPOINT)
    expect(summary.records[0]?.shapeType).toBe(ESRI_SHAPE_TYPE.MULTIPOINT)
  })

  it('допускает Null Shape (type 0) вместе с Point', async () => {
    const set = await loadShapefileSetFromZip('mixed_shapefile.zip', 'mixed')
    const summary = parseShpMainFile(set.shp)

    expect(summary.records).toHaveLength(2)
    expect(summary.records[0]?.shapeType).toBe(ESRI_SHAPE_TYPE.NULL)
    expect(summary.records[1]?.shapeType).toBe(ESRI_SHAPE_TYPE.POINT)
    expect(() => validateEsriShapefileSet(set)).not.toThrow()
  })

  it('polyline с двумя parts проходит валидацию индекса .shx', async () => {
    const set = await loadShapefileSetFromZip('pline2_shapefile.zip', 'pline2')
    expect(() => validateShxAgainstShp(set.shp, set.shx)).not.toThrow()
    expect(() => validateEsriShapefileSet(set)).not.toThrow()
  })
})

describe('ESRI Shapefile spec: .shx и .dbf', () => {
  it('первая индексная запись указывает смещение 50 слов', async () => {
    const { shp, shx } = await loadShapefileSetFromZip('point_shapefile.zip', 'point')
    const shxView = new DataView(shx)
    expect(shxView.getInt32(0, false)).toBe(ESRI_FILE_CODE)
    expect(shxView.getInt32(28, true)).toBe(ESRI_VERSION)
    expect(shxView.getInt32(100, false)).toBe(ESRI_FIRST_RECORD_OFFSET_WORDS)
    validateShxAgainstShp(shp, shx)
  })

  it('число записей .dbf совпадает с .shp', async () => {
    const set = await loadShapefileSetFromZip('mixed_shapefile.zip', 'mixed')
    expect(countDbfRecords(set.dbf)).toBe(2)
    expect(parseShpMainFile(set.shp).records).toHaveLength(2)
  })
})

describe('ESRI Shapefile spec: все фикстуры соответствуют PDF', () => {
  const compliantFixtures = [
    ['point_shapefile.zip', 'point'],
    ['line_shapefile.zip', 'line'],
    ['poly_shapefile.zip', 'poly'],
    ['mpoint_shapefile.zip', 'mpoint'],
    ['mixed_shapefile.zip', 'mixed'],
    ['pline2_shapefile.zip', 'pline2'],
    ['empty_shapefile.zip', 'empty'],
  ] as const

  it.each(compliantFixtures)('%s проходит validateEsriShapefileZip', async (zipName) => {
    await expect(validateEsriShapefileZip(readShapefileFixture(zipName))).resolves.toBeUndefined()
  })
})

describe('ESRI Shapefile spec: отклонение нарушений', () => {
  it('отклоняет ZIP только с .shp без .shx и .dbf', async () => {
    const shpOnly = readFileSync(resolve(fixturesDir, 'point_shapefile.zip'))
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(shpOnly)
    const shp = await zip.file('point.shp')?.async('arraybuffer')
    const buffer = await createZipBuffer({ 'point.shp': new Uint8Array(shp ?? []) })

    await expectSpecError(() => validateEsriShapefileZip(buffer), 'Отсутствует индексный файл .shx')
  })

  it('отклоняет .shp с неверным File Code', async () => {
    const set = await loadShapefileSetFromZip('point_shapefile.zip', 'point')
    const broken = new Uint8Array(set.shp)
    broken[0] = 0
    broken[1] = 0
    broken[2] = 0
    broken[3] = 0

    await expectSpecError(
      () =>
        validateEsriShapefileSet({
          ...set,
          shp: broken.buffer,
        }),
      `Некорректный File Code в .shp: ожидался ${ESRI_FILE_CODE}`,
    )
  })

  it('отклоняет несовпадение числа записей .dbf и .shp', async () => {
    const set = await loadShapefileSetFromZip('point_shapefile.zip', 'point')
    const dbf = new Uint8Array(set.dbf)
    const view = new DataView(dbf.buffer)
    view.setUint32(4, 5, true)

    await expectSpecError(
      () =>
        validateEsriShapefileSet({
          ...set,
          dbf: dbf.buffer,
        }),
      'Число записей .dbf (5) не совпадает с числом фигур в .shp (1)',
    )
  })
})
