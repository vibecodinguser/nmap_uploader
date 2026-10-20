import { describe, expect, it } from 'vitest'
import { processGeoFile } from '@/lib/geo_converters'

describe('processGeoFile (TDD slice 1: GeoJSON conversion via Result pattern)', () => {
  it('успешно конвертирует валидный GeoJSON Point и возвращает { ok: true, value }', async () => {
    const geoJsonContent = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [37.6176, 55.7558],
          },
          properties: { name: 'Moscow Center' },
        },
      ],
    })
    const buffer = new TextEncoder().encode(geoJsonContent).buffer

    const result = await processGeoFile({
      buffer,
      fileName: 'moscow.geojson',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const points = Object.values(result.value.points)
      expect(points).toHaveLength(1)
      expect(points[0]?.coords).toEqual([37.6176, 55.7558])
      expect(points[0]?.desc).toBe('Moscow Center')
    }
  })

  it('возвращает { ok: false, error } при неподдерживаемом формате файла', async () => {
    const buffer = new TextEncoder().encode('some text data').buffer

    const result = await processGeoFile({
      buffer,
      fileName: 'data.unsupported_ext',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ERR_SHAPEFILE')
      expect(result.error.message).toContain('Неподдерживаемый тип файла')
    }
  })

  it('возвращает { ok: false, error } при невалидном GeoJSON', async () => {
    const buffer = new TextEncoder().encode('{ not-a-json').buffer

    const result = await processGeoFile({
      buffer,
      fileName: 'invalid.geojson',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('GeoJSON')
    }
  })
})
