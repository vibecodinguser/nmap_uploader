import { describe, expect, it } from 'vitest'
import {
  buildGeoJsonFromNspdObjects,
  extractCadastralNumber,
  sanitizeCadastralFileName,
} from '@/lib/nspd/extractor'

describe('NSPD extractor', () => {
  it('извлекает кадастровый номер из текста', () => {
    expect(extractCadastralNumber('Земельный участок 77:01:0001001:1234 в Москве')).toBe(
      '77:01:0001001:1234',
    )
    expect(extractCadastralNumber('Здание 50:20:0010101:15')).toBe('50:20:0010101:15')
    expect(extractCadastralNumber('Без номера')).toBeNull()
  })

  it('извлекает кадастровый номер из свойств объекта', () => {
    expect(extractCadastralNumber({ cad_num: '77:01:0001001:99' })).toBe('77:01:0001001:99')
    expect(extractCadastralNumber({ cadastralNumber: '23:49:0101001:5' })).toBe('23:49:0101001:5')
  })

  it('санитизирует кадастровый номер для имени файла', () => {
    expect(sanitizeCadastralFileName('77:01:0001001:1234')).toBe('77_01_0001001_1234')
  })

  it('собирает FeatureCollection со свойствами и WGS84 координатами', () => {
    const rawObjects = [
      {
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [4431691.24, 5651590.72],
              [4431791.24, 5651690.72],
              [4431791.24, 5651590.72],
              [4431691.24, 5651590.72],
            ],
          ],
        },
        cadastralNumber: '77:01:0001001:1234',
        address: 'г. Москва, ул. Ленина, 1',
        area: 1250,
      },
    ]

    const { featureCollection, primaryName } = buildGeoJsonFromNspdObjects(rawObjects)
    expect(primaryName).toBe('77:01:0001001:1234')
    expect(featureCollection.features).toHaveLength(1)

    const feature = featureCollection.features[0]
    expect(feature.properties?.cadastralNumber).toBe('77:01:0001001:1234')
    expect(feature.properties?.address).toBe('г. Москва, ул. Ленина, 1')
    expect(feature.properties?.area).toBe('1250')

    const firstCoord = (feature.geometry as any).coordinates[0][0]
    expect(firstCoord[0]).toBeLessThan(180)
    expect(firstCoord[1]).toBeLessThan(90)
  })
})
