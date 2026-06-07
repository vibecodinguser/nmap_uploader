import { describe, expect, it } from 'vitest'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import {
  extractWktGeometryLines,
  extractWktKeyword,
  isCrsWktKeyword,
  isGeometryWktLine,
  isValidWktLatitude,
  isValidWktLongitude,
  parseAndValidateGeometryWkt,
  parseAndValidateWktText,
  validateGeometryWktLine,
} from '@/lib/wkt/wkt_spec'
import { readWktFixture } from '../fixtures/wkt_fixtures'

const expectWktError = (run: () => void, messageIncludes: string): void => {
  try {
    run()
    expect.fail('Ожидалась ProcessingError')
  } catch (error) {
    expect(error).toBeInstanceOf(ProcessingError)
    expect((error as ProcessingError).code).toBe(ERR_SHAPEFILE)
    expect((error as ProcessingError).message).toContain(messageIncludes)
  }
}

describe('OGC 18-010r11 / WKT: синтаксис §6', () => {
  it('ключевые слова геометрии нечувствительны к регистру (§6.5)', () => {
    expect(isGeometryWktLine('point (1 2)')).toBe(true)
    expect(isGeometryWktLine('Point Z (1 2 3)')).toBe(true)
  })

  it('отклоняет десятичную запятую в числах (§6.3.2)', () => {
    expectWktError(
      () => validateGeometryWktLine('POINT (37,6176 55.7558)'),
      'десятичный разделитель — точка',
    )
  })

  it('отклоняет квадратные скобки CRS WKT (§6.4)', () => {
    expectWktError(() => validateGeometryWktLine('POINT [37.6 55.7]'), 'квадратные скобки')
  })

  it('отклоняет CRS WKT2 GEOGCRS (§6.6)', () => {
    const line = readWktFixture('crs_geogcrs.wkt').trim()
    expect(isCrsWktKeyword(extractWktKeyword(line) ?? '')).toBe(true)
    expectWktError(() => validateGeometryWktLine(line), 'CRS WKT (GEOGCRS)')
  })

  it('отклоняет legacy CRS WKT1 PROJCS', () => {
    expectWktError(
      () => validateGeometryWktLine('PROJCS["WGS 84 / UTM zone 33N",GEOGCS["WGS 84"]]'),
      'CRS WKT (PROJCS)',
    )
  })
})

describe('WKT geometry: координаты WGS84', () => {
  it('longitude в диапазоне [-180, 180)', () => {
    expect(isValidWktLongitude(-180)).toBe(true)
    expect(isValidWktLongitude(180)).toBe(false)
  })

  it('latitude в диапазоне [-90, 90]', () => {
    expect(isValidWktLatitude(90)).toBe(true)
    expect(isValidWktLatitude(-90.1)).toBe(false)
  })

  it('отклоняет lon=180 в POINT', () => {
    expectWktError(() => parseAndValidateGeometryWkt('POINT (180 55)'), 'вне диапазона [-180, 180)')
  })

  it('отклоняет lat=91 в POINT', () => {
    expectWktError(() => parseAndValidateGeometryWkt('POINT (37 91)'), 'вне диапазона [-90, 90]')
  })
})

describe('WKT geometry: фикстуры', () => {
  it('point.wkt проходит валидацию', () => {
    const geometries = parseAndValidateWktText(readWktFixture('point.wkt'))
    expect(geometries).toHaveLength(1)
    expect(geometries[0]?.type).toBe('Point')
  })

  it('line.wkt и polygon.wkt проходят валидацию', () => {
    expect(parseAndValidateWktText(readWktFixture('line.wkt'))[0]?.type).toBe('LineString')
    expect(parseAndValidateWktText(readWktFixture('polygon.wkt'))[0]?.type).toBe('Polygon')
  })

  it('extractWktGeometryLines пропускает комментарии', () => {
    const lines = extractWktGeometryLines(readWktFixture('point.wkt'))
    expect(lines).toEqual(['POINT (37.6176 55.7558)'])
  })
})
