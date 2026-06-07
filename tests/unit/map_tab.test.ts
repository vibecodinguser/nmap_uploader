import { describe, expect, it } from 'vitest'
import { isMapTabUrl } from '@/lib/map_tab'

describe('isMapTabUrl', () => {
  it('распознаёт origin без пути', () => {
    expect(isMapTabUrl('https://n.maps.yandex.ru')).toBe(true)
  })

  it('распознаёт корень и вложенные пути', () => {
    expect(isMapTabUrl('https://n.maps.yandex.ru/')).toBe(true)
    expect(isMapTabUrl('https://n.maps.yandex.ru/editor/123')).toBe(true)
  })

  it('отклоняет другие домены', () => {
    expect(isMapTabUrl('https://yandex.ru/maps')).toBe(false)
    expect(isMapTabUrl(undefined)).toBe(false)
  })
})
