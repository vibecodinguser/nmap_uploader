import { describe, expect, it } from 'vitest'
import {
  buildNakarteHash,
  buildNakarteUrl,
  buildNmapsUrlFromLocation,
  getMapLocationFromNakarteUrl,
  locationsEqual,
  normalizeMapLocation,
  normalizeMapZoom,
} from '@/lib/go_to_map_sync'

describe('getMapLocationFromNakarteUrl', () => {
  it('извлекает координаты и зум из hash nakarte', () => {
    const location = getMapLocationFromNakarteUrl(
      'https://nakarte.me/#m=14/44.969538/39.187968&l=S/K',
    )

    expect(location).toEqual({
      longitude: 39.187968,
      latitude: 44.969538,
      zoom: 14,
    })
  })

  it('возвращает null при отсутствии параметра m', () => {
    expect(getMapLocationFromNakarteUrl('https://nakarte.me/')).toBeNull()
  })
})

describe('buildNakarteUrl', () => {
  it('собирает https-ссылку nakarte', () => {
    const url = buildNakarteUrl({ longitude: 37.6, latitude: 55.7, zoom: 12 })
    expect(url).toBe('https://nakarte.me/#m=12/55.7000000/37.6000000&l=S/K')
  })
})

describe('buildNakarteHash', () => {
  it('форматирует координаты с точностью nakarte', () => {
    expect(buildNakarteHash({ longitude: 37.6123456, latitude: 55.7123456, zoom: 12 })).toBe(
      'm=12/55.7123456/37.6123456&l=S/K',
    )
  })
})

describe('buildNmapsUrlFromLocation', () => {
  it('обновляет ll и z, сохраняя путь и остальные параметры', () => {
    const current =
      'https://n.maps.yandex.ru/#!/objects/3470560507?z=14&ll=39.187968%2C44.969538&l=nk%23sat'
    const next = buildNmapsUrlFromLocation({ longitude: 37.6, latitude: 55.7, zoom: 12 }, current)

    expect(next).toContain('#!/objects/3470560507?')
    expect(next).toContain('ll=37.6%2C55.7')
    expect(next).toContain('z=12')
    expect(next).toContain('l=nk%23sat')
  })
})

describe('normalizeMapZoom', () => {
  it('ограничивает зум, но сохраняет дроби', () => {
    expect(normalizeMapZoom(14.6)).toBe(14.6)
    expect(normalizeMapZoom(-1)).toBe(0)
    expect(normalizeMapZoom(40)).toBe(32)
  })
})

describe('normalizeMapLocation', () => {
  it('нормализует зум в координатах', () => {
    expect(normalizeMapLocation({ longitude: 37.6, latitude: 55.7, zoom: 14.8 })).toEqual({
      longitude: 37.6,
      latitude: 55.7,
      zoom: 14.8,
    })
  })
})

describe('locationsEqual', () => {
  it('считает близкие координаты равными', () => {
    expect(
      locationsEqual(
        { longitude: 37.6, latitude: 55.7, zoom: 12 },
        { longitude: 37.6000000001, latitude: 55.7000000001, zoom: 12 },
      ),
    ).toBe(true)
  })

  it('возвращает false при null', () => {
    expect(locationsEqual(null, { longitude: 1, latitude: 2, zoom: 3 })).toBe(false)
  })
})
