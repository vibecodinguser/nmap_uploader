// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { centerMapOnLocation, NmapsObjectDrawer, requestMapRepaint } from '@/lib/nmaps'

describe('nmaps repaint & object_drawer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('requestMapRepaint', () => {
    it('синхронно вызывает fitToViewport и центрирует карту при передаче detail с координатами', () => {
      const fitMock = vi.fn()
      const setCenterMock = vi.fn()
      const mockMap = {
        container: { fitToViewport: fitMock },
        setCenter: setCenterMock,
      } as any

      const event = new CustomEvent('nmaps:mapResize', {
        detail: { latitude: 55.75, longitude: 37.61, zoom: 16 },
      })

      requestMapRepaint(event, () => mockMap)

      expect(fitMock).toHaveBeenCalled()
      expect(setCenterMock).toHaveBeenCalledWith([37.61, 55.75], 16, { duration: 0 })
    })
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
    it('отрисовывает только несохранённые геообъекты (без id) с прозрачной интерактивностью', () => {
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
              id: 'saved-polygon',
              geomType: 'Polygon',
              geomCoords: [
                [37, 55],
                [38, 56],
              ],
            },
            {
              localId: 'temp-1',
              geomType: 'Polygon',
              geomCoords: [
                [37, 55],
                [38, 56],
              ],
            },
            {
              localId: 'temp-2',
              geomType: 'LineString',
              geomCoords: [
                [37, 55],
                [38, 56],
              ],
            },
            { localId: 'temp-3', geomType: 'Point', latitude: 55, longitude: 37 },
          ],
          snapTargets: [],
        },
        () => mockMap,
      )

      expect(mockYmaps.GeoObjectCollection).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          interactivityModel: 'default#transparent',
        }),
      )
      expect(mockYmaps.Polygon).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          fill: true,
          interactivityModel: 'default#transparent',
        }),
      )
      expect(geoObjectsAddMock).toHaveBeenCalledWith(mockCollection)
      expect(removeAllMock).toHaveBeenCalledTimes(1)
      expect(addMock).toHaveBeenCalledTimes(3)
    })

    it('не создаёт коллекцию и очищает существующую, если все объекты уже сохранены (имеют id)', () => {
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

      const mockYmaps = {
        GeoObjectCollection: vi.fn(function (this: any) {
          return mockCollection
        }),
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
              id: 'saved-nspd-polygon',
              geomType: 'Polygon',
              geomCoords: [
                [37, 55],
                [38, 55],
                [38, 56],
                [37, 55],
              ],
            },
          ],
          snapTargets: [],
        },
        () => mockMap,
      )

      expect(mockYmaps.GeoObjectCollection).not.toHaveBeenCalled()
      expect(addMock).not.toHaveBeenCalled()
    })
  })
})
