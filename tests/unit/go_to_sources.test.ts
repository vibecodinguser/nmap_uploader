import { describe, expect, it } from 'vitest'
import { getGoToSourceDisplayName, getGoToSourceIconUrl } from '@/lib/go_to_sources'

describe('getGoToSourceDisplayName', () => {
  it('возвращает displayName известного источника', () => {
    expect(getGoToSourceDisplayName('Google')).toBe('Google Maps')
    expect(getGoToSourceDisplayName('Rosreestr')).toBe('Портал НСПД')
  })

  it('возвращает исходное имя для неизвестного источника', () => {
    expect(getGoToSourceDisplayName('Unknown')).toBe('Unknown')
  })
})

describe('getGoToSourceIconUrl', () => {
  it('нормализует protocol-relative iconUrl', () => {
    expect(getGoToSourceIconUrl('Google')).toBe(
      'https://favicon.yandex.net/favicon/maps.google.ru?size=32&stub=1',
    )
  })

  it('строит favicon URL по домену из linkTemplate', () => {
    expect(getGoToSourceIconUrl('2GIS')).toBe('https://favicon.yandex.net/favicon/2gis.ru?stub=1')
    expect(getGoToSourceIconUrl('OpenStreetMap')).toBe(
      'https://favicon.yandex.net/favicon/www.openstreetmap.org?stub=1',
    )
  })

  it('возвращает пустую строку для неизвестного источника', () => {
    expect(getGoToSourceIconUrl('Unknown')).toBe('')
  })
})

describe('GO_TO_SOURCES linkTemplate', () => {
  it('использует только HTTPS для внешних переходов', async () => {
    const { GO_TO_SOURCES } = await import('@/lib/go_to_sources')

    for (const [name, source] of Object.entries(GO_TO_SOURCES)) {
      expect(source.linkTemplate, name).toMatch(/^https:\/\//u)
    }
  })
})
