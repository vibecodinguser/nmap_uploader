import { describe, expect, it } from 'vitest'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import {
  GEOJSON_GEOMETRY_TYPES,
  GEOJSON_ROOT_TYPES,
  normalizeGeoJsonRoot,
  parseAndValidateGeoJsonText,
  validateGeoJsonBbox,
  validateGeoJsonPosition,
} from '@/lib/geojson/geojson_spec'
import { readGeoJsonFixture } from '../fixtures/geojson_fixtures'

const expectGeoJsonError = (run: () => void, messageIncludes: string): void => {
  try {
    run()
    expect.fail('Ожидалась ProcessingError')
  } catch (error) {
    expect(error).toBeInstanceOf(ProcessingError)
    expect((error as ProcessingError).code).toBe(ERR_SHAPEFILE)
    expect((error as ProcessingError).message).toContain(messageIncludes)
  }
}

describe('RFC 7946: типы GeoJSON', () => {
  it('содержит все 9 типов геометрии и корневые Feature/FeatureCollection', () => {
    expect(GEOJSON_GEOMETRY_TYPES.size).toBe(7)
    expect(GEOJSON_ROOT_TYPES.has('Feature')).toBe(true)
    expect(GEOJSON_ROOT_TYPES.has('FeatureCollection')).toBe(true)
    expect(GEOJSON_ROOT_TYPES.has('Point')).toBe(true)
  })

  it('point.geojson, line.geojson и polygon.geojson проходят валидацию', () => {
    expect(() => parseAndValidateGeoJsonText(readGeoJsonFixture('point.geojson'))).not.toThrow()
    expect(() => parseAndValidateGeoJsonText(readGeoJsonFixture('line.geojson'))).not.toThrow()
    expect(() => parseAndValidateGeoJsonText(readGeoJsonFixture('polygon.geojson'))).not.toThrow()
  })

  it('отклоняет type в нижнем регистре (§1.4)', () => {
    expectGeoJsonError(
      () => parseAndValidateGeoJsonText(readGeoJsonFixture('invalid_lowercase_type.geojson')),
      'RFC 7946',
    )
  })

  it('отклоняет устаревший crs (§4)', () => {
    expectGeoJsonError(
      () => parseAndValidateGeoJsonText(readGeoJsonFixture('with_crs.geojson')),
      'crs',
    )
  })

  it('отклоняет пустой FeatureCollection без геометрии', () => {
    expectGeoJsonError(
      () => parseAndValidateGeoJsonText(readGeoJsonFixture('empty_features.geojson')),
      'не содержит геометрии',
    )
  })
})

describe('RFC 7946: Position (§3.1.1)', () => {
  it('принимает [lon, lat] и [lon, lat, alt]', () => {
    expect(() => validateGeoJsonPosition([37.6, 55.75], 'test')).not.toThrow()
    expect(() => validateGeoJsonPosition([37.6, 55.75, 120], 'test')).not.toThrow()
  })

  it('отклоняет position с одним элементом', () => {
    expectGeoJsonError(
      () => validateGeoJsonPosition([37.6], 'test'),
      'минимум longitude и latitude',
    )
  })

  it('отклоняет position с 4+ элементами', () => {
    expectGeoJsonError(
      () => validateGeoJsonPosition([37.6, 55.75, 0, 1], 'test'),
      'более 3 элементов',
    )
  })

  it('отклоняет lon вне [-180, 180]', () => {
    expectGeoJsonError(() => validateGeoJsonPosition([200, 55], 'test'), 'longitude')
  })

  it('отклоняет lat вне [-90, 90]', () => {
    expectGeoJsonError(() => validateGeoJsonPosition([37, 95], 'test'), 'latitude')
  })
})

describe('RFC 7946: LineString и Polygon (§3.1.4–3.1.6)', () => {
  it('отклоняет LineString с одной позицией', () => {
    expectGeoJsonError(
      () => parseAndValidateGeoJsonText(readGeoJsonFixture('invalid_linestring.geojson')),
      'минимум 2 позиции',
    )
  })

  it('отклоняет незамкнутый linear ring', () => {
    expectGeoJsonError(
      () => parseAndValidateGeoJsonText(readGeoJsonFixture('invalid_ring.geojson')),
      'замкнут',
    )
  })
})

describe('RFC 7946: bbox (§5)', () => {
  it('принимает bbox из 4 и 6 чисел', () => {
    expect(() => validateGeoJsonBbox([-10, -10, 10, 10], 'bbox')).not.toThrow()
    expect(() => validateGeoJsonBbox([100, 0, -100, 105, 1, 0], 'bbox')).not.toThrow()
  })

  it('отклоняет bbox неправильной длины', () => {
    expectGeoJsonError(() => validateGeoJsonBbox([0, 0, 1], 'bbox'), '4 или 6 чисел')
  })
})

describe('RFC 7946: Geometry на корне', () => {
  it('нормализует Point в Feature', () => {
    const normalized = normalizeGeoJsonRoot(JSON.parse(readGeoJsonFixture('geometry_root.geojson')))
    expect(normalized.type).toBe('Feature')
    if (normalized.type !== 'Feature') return
    expect(normalized.geometry?.type).toBe('Point')
  })

  it('конвертируемая геометрия на корне проходит parseAndValidateGeoJsonText', () => {
    const data = parseAndValidateGeoJsonText(readGeoJsonFixture('geometry_root.geojson'))
    expect(data.type).toBe('Feature')
    if (data.type !== 'Feature') return
    expect(data.geometry?.type).toBe('Point')
  })
})
