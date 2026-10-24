import { describe, expect, it } from 'vitest'
import { buildGoToLink, getMapLocationFromUrl, type MapLocation } from '@/lib/go_to/links'
import type { GoToSource } from '@/lib/go_to_sources'

describe('GoTo Links Core (TDD slice: pure URL parsing and templating)', () => {
  it('извлекает координаты и зум из URL Народной карты', () => {
    const url = 'https://n.maps.yandex.ru/#!/?z=17&ll=37.6176%2C55.7558&l=nk%23sat'
    const location = getMapLocationFromUrl(url)

    expect(location).toEqual<MapLocation>({
      longitude: 37.6176,
      latitude: 55.7558,
      zoom: 17,
      layer: 'nk#sat',
    })
  })

  it('возвращает null для некорректного URL без координат', () => {
    expect(getMapLocationFromUrl('https://n.maps.yandex.ru/')).toBeNull()
    expect(getMapLocationFromUrl('invalid-url')).toBeNull()
  })

  it('генерирует ссылку на сторонний геосервис по шаблону источника', () => {
    const source: GoToSource = {
      displayName: 'OpenStreetMap',
      linkTemplate: 'https://www.openstreetmap.org/#map={zoom}/{lat}/{lon}',
    }

    const location: MapLocation = {
      longitude: 37.6176,
      latitude: 55.7558,
      zoom: 16,
    }

    const link = buildGoToLink({ source, location })
    expect(link).toBe('https://www.openstreetmap.org/#map=16/55.7558/37.6176')
  })
})
