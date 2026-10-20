import { describe, expect, it } from 'vitest'
import { processGeoFile } from '@/lib/geo_converters'
import { readGpxFixtureBuffer } from '../../fixtures/gpx_fixtures'
import { readKmlFixtureBuffer } from '../../fixtures/kml_fixtures'
import { createShapefileFixture } from '../../fixtures/shapefile_fixtures'
import { readTopoJsonFixtureBuffer } from '../../fixtures/topojson_fixtures'
import { readWktFixtureBuffer } from '../../fixtures/wkt_fixtures'

describe('processGeoFile (TDD slice 2: multi-format support)', () => {
  it('успешно конвертирует KML файл', async () => {
    const buffer = readKmlFixtureBuffer('point.kml')
    const result = await processGeoFile({
      buffer,
      fileName: 'point.kml',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const points = Object.values(result.value.points)
      expect(points.length).toBeGreaterThan(0)
    }
  })

  it('успешно конвертирует GPX файл', async () => {
    const buffer = readGpxFixtureBuffer('point.gpx')
    const result = await processGeoFile({
      buffer,
      fileName: 'point.gpx',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const points = Object.values(result.value.points)
      expect(points.length).toBeGreaterThan(0)
    }
  })

  it('успешно конвертирует TopoJSON файл', async () => {
    const buffer = readTopoJsonFixtureBuffer('point_topo.topojson')
    const result = await processGeoFile({
      buffer,
      fileName: 'point_topo.topojson',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const points = Object.values(result.value.points)
      expect(points.length).toBeGreaterThan(0)
    }
  })

  it('успешно конвертирует WKT файл', async () => {
    const buffer = readWktFixtureBuffer('point.wkt')
    const result = await processGeoFile({
      buffer,
      fileName: 'point.wkt',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const points = Object.values(result.value.points)
      expect(points.length).toBeGreaterThan(0)
    }
  })

  it('успешно конвертирует ESRI Shapefile в ZIP-архиве', async () => {
    const buffer = await createShapefileFixture('point_shapefile.zip')
    const result = await processGeoFile({
      buffer,
      fileName: 'point_shapefile.zip',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const points = Object.values(result.value.points)
      expect(points).toHaveLength(1)
      expect(points[0]?.desc).toBe('Kreml')
    }
  })

  it('возвращает типизированную ошибку при пустом KML', async () => {
    const buffer = readKmlFixtureBuffer('metadata_only.kml')
    const result = await processGeoFile({
      buffer,
      fileName: 'metadata_only.kml',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ERR_SHAPEFILE')
      expect(result.error.message).toContain('геометри')
    }
  })
})
