import type { Feature } from 'geojson'
import { describe, expect, it } from 'vitest'
import { extractFeatureName } from '@/lib/geo_converters/feature_names'

describe('extractFeatureName (TDD slice: GeoJSON attribute extraction)', () => {
  it('извлекает имя объекта по ключам name, title, Name и т.д.', () => {
    const f1 = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { name: 'Парк Горького' },
    } as unknown as Feature

    const f2 = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { title: 'Красная Площадь' },
    } as unknown as Feature

    expect(extractFeatureName(f1)).toBe('Парк Горького')
    expect(extractFeatureName(f2)).toBe('Красная Площадь')
  })

  it('обрезает пробелы и игнорирует пустые строки', () => {
    const f = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { name: '   Введенское   ' },
    } as unknown as Feature

    expect(extractFeatureName(f)).toBe('Введенское')
  })

  it('возвращает undefined, если имя отсутствует или пустое', () => {
    const fEmpty = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { name: '   ' },
    } as unknown as Feature

    const fNoProps = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: null,
    } as unknown as Feature

    expect(extractFeatureName(fEmpty)).toBeUndefined()
    expect(extractFeatureName(fNoProps)).toBeUndefined()
  })
})
