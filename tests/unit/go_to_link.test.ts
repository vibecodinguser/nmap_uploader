import { describe, expect, it } from 'vitest'
import { buildGoToLink, getMapLocationFromUrl, resolveMapLocationForSource } from '@/lib/go_to_link'
import { GO_TO_SOURCES } from '@/lib/go_to_sources'

describe('getMapLocationFromUrl', () => {
  it('извлекает координаты и зум из hash-URL НЯК', () => {
    const location = getMapLocationFromUrl(
      'https://n.maps.yandex.ru/#!/objects/1?z=14&ll=39.187968%2C44.969538&l=nk',
    )

    expect(location).toEqual({
      longitude: 39.187968,
      latitude: 44.969538,
      zoom: 14,
      layer: 'nk',
    })
  })

  it('возвращает null при отсутствии параметров', () => {
    expect(getMapLocationFromUrl('https://n.maps.yandex.ru/')).toBeNull()
  })

  it('извлекает координаты из query внутри hash без path', () => {
    const location = getMapLocationFromUrl('https://n.maps.yandex.ru/#!?z=12&ll=37.6%2C55.7&l=nk')

    expect(location).toEqual({
      longitude: 37.6,
      latitude: 55.7,
      zoom: 12,
      layer: 'nk',
    })
  })
})

describe('buildGoToLink', () => {
  it('подставляет координаты в шаблон 2ГИС', () => {
    const link = buildGoToLink(
      GO_TO_SOURCES['2GIS'],
      { longitude: 37.6, latitude: 55.7, zoom: 12 },
      new Date('2026-06-08T12:00:00Z'),
    )

    expect(link).toBe('https://2gis.ru/center?m=37.6%2C55.7%2F12')
  })

  it('ограничивает зум и применяет countZoom', () => {
    const resolved = resolveMapLocationForSource(
      { longitude: 19, latitude: 50, zoom: 20 },
      { linkTemplate: 'https://example.com', maxZoom: 17, countZoom: [1, -1] },
    )

    expect(resolved.zoom).toBe(16)
  })

  it('конвертирует координаты в Mercator для Rosreestr', () => {
    const location = { longitude: 37.6, latitude: 55.7, zoom: 12 }
    const resolved = resolveMapLocationForSource(location, GO_TO_SOURCES.Rosreestr)

    const expectedLon = 6_378_137 * 37.6 * (Math.PI / 180)
    const expectedLat = 6_378_137 * Math.log(Math.tan(Math.PI / 4 + (55.7 * (Math.PI / 180)) / 2))

    expect(resolved.longitude).toBeCloseTo(expectedLon, 5)
    expect(resolved.latitude).toBeCloseTo(expectedLat, 5)
    expect(resolved.zoom).toBe(12)
  })

  it('подставляет дату и предыдущий месяц в шаблон', () => {
    const link = buildGoToLink(
      {
        linkTemplate:
          'https://example.com/?y={year}&m={month}&d={day}&py={prevYear}&pm={prevMonth}&z={zoom}',
      },
      { longitude: 10, latitude: 20, zoom: 8 },
      new Date('2026-03-15T12:00:00Z'),
    )

    expect(link).toBe('https://example.com/?y=2026&m=03&d=15&py=2026&pm=02&z=8')
  })

  it('собирает ссылку Rosreestr с Mercator-координатами', () => {
    const link = buildGoToLink(
      GO_TO_SOURCES.Rosreestr,
      { longitude: 37.6, latitude: 55.7, zoom: 12 },
      new Date('2026-06-08T12:00:00Z'),
    )

    const resolved = resolveMapLocationForSource(
      { longitude: 37.6, latitude: 55.7, zoom: 12 },
      GO_TO_SOURCES.Rosreestr,
    )

    expect(link).toContain(`zoom=12`)
    expect(link).toContain(`coordinate_x=${resolved.longitude}`)
    expect(link).toContain(`coordinate_y=${resolved.latitude}`)
  })
})
