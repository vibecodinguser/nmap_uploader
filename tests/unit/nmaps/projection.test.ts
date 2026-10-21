import { describe, expect, it } from 'vitest'
import {
  calculateMetersPerPixel,
  isValidMapView,
  latLonToMercator,
  mercatorToLatLon,
  projectScreenClickToLatLon,
} from '@/lib/nmaps/projection'

describe('nmaps/projection', () => {
  it('корректно конвертирует lat/lon в Меркатор и обратно (обратимость)', () => {
    const lat = 55.75
    const lon = 37.61
    const merc = latLonToMercator(lat, lon)
    const back = mercatorToLatLon(merc.x, merc.y)

    expect(back.lat).toBeCloseTo(lat, 5)
    expect(back.lon).toBeCloseTo(lon, 5)
  })

  it('calculateMetersPerPixel уменьшается в 2 раза при увеличении зума на 1', () => {
    const mpp10 = calculateMetersPerPixel(10)
    const mpp11 = calculateMetersPerPixel(11)
    expect(mpp10 / mpp11).toBeCloseTo(2, 5)
  })

  it('projectScreenClickToLatLon возвращает центр при клике точно в центр', () => {
    const res = projectScreenClickToLatLon(200, 200, 200, 200, 55.75, 37.61, 15)
    expect(res.lat).toBeCloseTo(55.75, 5)
    expect(res.lon).toBeCloseTo(37.61, 5)
  })

  it('isValidMapView валидирует массив координат и числовой зум', () => {
    expect(isValidMapView([55.75, 37.61], 15)).toBe(true)
    expect(isValidMapView([55.75], 15)).toBe(false)
    expect(isValidMapView(null, 15)).toBe(false)
    expect(isValidMapView([55.75, 37.61], null)).toBe(false)
  })
})
