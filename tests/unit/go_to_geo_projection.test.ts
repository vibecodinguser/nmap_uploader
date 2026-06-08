import { describe, expect, it } from 'vitest'
import { latLngToPanelPixel, mouseToLatLng } from '@/lib/go_to_geo_projection'

const view = { longitude: 37.6, latitude: 55.7, zoom: 12 }
const panel = { width: 800, height: 600 }

describe('mouseToLatLng / latLngToPanelPixel', () => {
  it('центр панели соответствует центру вида', () => {
    const center = mouseToLatLng(panel.width / 2, panel.height / 2, view, panel)
    expect(center.longitude).toBeCloseTo(view.longitude, 5)
    expect(center.latitude).toBeCloseTo(view.latitude, 5)
  })

  it('обратное преобразование возвращает исходную точку курсора', () => {
    const cursor = mouseToLatLng(420, 310, view, panel)
    const pixel = latLngToPanelPixel(cursor, view, panel)

    expect(pixel?.x).toBeCloseTo(420, 0)
    expect(pixel?.y).toBeCloseTo(310, 0)
  })
})
