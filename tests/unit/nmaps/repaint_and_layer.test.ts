// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { centerMapOnLocation, requestMapRepaint } from '@/lib/nmaps'
import type { Note } from '@/lib/notes/model/types'
import { NotesLayer } from '@/lib/notes_layer'

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Point',
  name: 'Точка',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: { color: '#1a8cff', fillColor: null, hatch: null, opacity: 1, strokeWidth: 3 },
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

const createYmapsMock = () => {
  const collection = {
    add: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
    events: { add: vi.fn() },
  }

  const ymaps = {
    GeoObjectCollection: vi.fn(function (this: unknown) {
      return collection
    }),
    Placemark: vi.fn(),
    Polyline: vi.fn(),
    Polygon: vi.fn(),
  }

  return { ymaps, collection }
}

const createMapMock = () => ({
  geoObjects: { add: vi.fn() },
  events: { add: vi.fn(), remove: vi.fn() },
  getZoom: vi.fn(() => 16),
  getCenter: vi.fn(() => [37.6, 55.7]),
})

describe('nmaps repaint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

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

describe('NotesLayer', () => {
  afterEach(() => {
    delete (globalThis as { ymaps?: unknown }).ymaps
  })

  it('создаёт собственную коллекцию и рисует точки и линии', () => {
    const { ymaps, collection } = createYmapsMock()
    const map = createMapMock()
    ;(globalThis as { ymaps?: unknown }).ymaps = ymaps

    const layer = new NotesLayer(() => map as any)
    layer.render({
      notes: [makeNote(), makeNote({ id: 'line-1', kind: 'Line' })],
      geometries: {
        'note-1': { kind: 'Point', coords: [37.6, 55.7] },
        'line-1': {
          kind: 'Line',
          coords: [
            [37.6, 55.7],
            [37.7, 55.8],
          ],
        },
      },
      groups: [],
      hiddenIds: [],
      iconUrls: {},
    })

    expect(ymaps.GeoObjectCollection).toHaveBeenCalledTimes(1)
    expect(map.geoObjects.add).toHaveBeenCalledWith(collection)
    expect(ymaps.Placemark).toHaveBeenCalledTimes(1)
    expect(ymaps.Polyline).toHaveBeenCalledTimes(1)
    expect(collection.add).toHaveBeenCalledTimes(2)
  })

  it('не рисует скрытые заметки', () => {
    const { ymaps, collection } = createYmapsMock()
    const map = createMapMock()
    ;(globalThis as { ymaps?: unknown }).ymaps = ymaps

    const layer = new NotesLayer(() => map as any)
    layer.render({
      notes: [makeNote()],
      geometries: { 'note-1': { kind: 'Point', coords: [37.6, 55.7] } },
      groups: [],
      hiddenIds: ['note-1'],
      iconUrls: {},
    })

    expect(collection.add).not.toHaveBeenCalled()
  })

  it('выбор линии пересоздаёт только её объект, не всю коллекцию', () => {
    const { ymaps, collection } = createYmapsMock()
    const map = createMapMock()
    ;(globalThis as { ymaps?: unknown }).ymaps = ymaps

    const layer = new NotesLayer(() => map as any)
    layer.render({
      notes: [
        makeNote(),
        makeNote({ id: 'line-1', kind: 'Line', name: 'Линия' }),
        makeNote({ id: 'note-2', name: 'Вторая точка' }),
      ],
      geometries: {
        'note-1': { kind: 'Point', coords: [37.6, 55.7] },
        'line-1': {
          kind: 'Line',
          coords: [
            [37.6, 55.7],
            [37.7, 55.8],
          ],
        },
        'note-2': { kind: 'Point', coords: [38.6, 56.7] },
      },
      groups: [],
      hiddenIds: [],
      iconUrls: {},
    })
    expect(collection.add).toHaveBeenCalledTimes(3)

    layer.select('line-1')

    // У выбранной линии граница толще — её объект пересоздан; точки не тронуты.
    expect(collection.removeAll).not.toHaveBeenCalled()
    expect(collection.remove).toHaveBeenCalledTimes(1)
    expect(collection.add).toHaveBeenCalledTimes(4)
  })

  it('выбор точки не пересоздаёт объект: у точки выделения нет', () => {
    const { ymaps, collection } = createYmapsMock()
    const map = createMapMock()
    ;(globalThis as { ymaps?: unknown }).ymaps = ymaps

    const layer = new NotesLayer(() => map as any)
    layer.render({
      notes: [makeNote()],
      geometries: { 'note-1': { kind: 'Point', coords: [37.6, 55.7] } },
      groups: [],
      hiddenIds: [],
      iconUrls: {},
    })
    collection.add.mockClear()

    layer.select('note-1')

    expect(collection.add).not.toHaveBeenCalled()
    expect(collection.removeAll).not.toHaveBeenCalled()
  })
})
