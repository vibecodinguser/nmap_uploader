// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { centerMapOnLocation, NmapsObjectDrawer } from '@/lib/nmaps'

describe('nmaps repaint & object_drawer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('centerMapOnLocation', () => {
    it('вызывает setCenter у активной карты с переданными координатами и зумом', () => {
      const setCenterMock = vi.fn()
      const mockMap = {
        setCenter: setCenterMock,
      } as any

      centerMapOnLocation(
        { latitude: 55.75, longitude: 37.61, zoom: 16, duration: 100 },
        () => mockMap,
      )

      expect(setCenterMock).toHaveBeenCalledWith([37.61, 55.75], 16, { duration: 100 })
    })

    it('при отсутствии метода setCenter меняет location.hash', () => {
      centerMapOnLocation({ latitude: 55.75, longitude: 37.61, zoom: 16 }, () => null)

      expect(globalThis.location.hash).toContain('37.61,55.75')
    })
  })

  describe('NmapsObjectDrawer', () => {
    it('корректно создает GeoObjectCollection и добавляет геообъекты', () => {
      const addMock = vi.fn()
      const removeAllMock = vi.fn()
      const geoObjectsAddMock = vi.fn()

      const mockCollection = {
        add: addMock,
        removeAll: removeAllMock,
      }

      const mockMap = {
        geoObjects: {
          add: geoObjectsAddMock,
        },
      } as any

      const MockCollectionConstructor = vi.fn(function (this: any) {
        return mockCollection
      })

      const mockYmaps = {
        GeoObjectCollection: MockCollectionConstructor,
        Polygon: vi.fn(),
        Polyline: vi.fn(),
        Placemark: vi.fn(),
      }

      ;(globalThis as any).ymaps = mockYmaps

      const drawer = new NmapsObjectDrawer()
      drawer.drawObjects(
        {
          points: [
            {
              id: '1',
              geomType: 'Polygon',
              geomCoords: [
                [37, 55],
                [38, 56],
              ],
            },
            {
              id: '2',
              geomType: 'LineString',
              geomCoords: [
                [37, 55],
                [38, 56],
              ],
            },
            { id: '3', geomType: 'Point', latitude: 55, longitude: 37 },
          ],
          snapTargets: [],
        },
        () => mockMap,
      )

      expect(mockYmaps.GeoObjectCollection).toHaveBeenCalledTimes(1)
      expect(geoObjectsAddMock).toHaveBeenCalledWith(mockCollection)
      expect(removeAllMock).toHaveBeenCalledTimes(1)
      expect(addMock).toHaveBeenCalledTimes(3)
    })
  })
})
