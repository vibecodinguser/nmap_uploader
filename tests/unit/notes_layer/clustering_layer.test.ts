// @vitest-environment happy-dom

/**
 * Кластеризация на слое карты.
 *
 * Проверяем связку: на дальнем зуме близкие точки заменяются значком с числом,
 * на близком снова расходятся, а клик по значку приближает карту, а не
 * выбирает заметку.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '@/lib/notes/model/types'
import { NotesLayer } from '@/lib/notes_layer'
import { CLUSTER_MAX_ZOOM } from '@/lib/notes_layer/clustering'
import { NMAPS_NOTE_SELECTED_EVENT } from '@/lib/notes_layer/protocol'

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

type FakeObject = {
  kind: string
  coordinates: unknown
  properties: Record<string, unknown>
  options: Record<string, unknown>
}

const createCollection = () => {
  const objects: FakeObject[] = []
  const handlers: Array<(event: unknown) => void> = []
  return {
    objects,
    handlers,
    collection: {
      add: (object: FakeObject) => {
        objects.push(object)
      },
      remove: (object: FakeObject) => {
        const index = objects.indexOf(object)
        if (index >= 0) objects.splice(index, 1)
      },
      removeAll: () => {
        objects.length = 0
      },
      events: {
        add: (_name: string, handler: (event: unknown) => void) => {
          handlers.push(handler)
        },
      },
    },
  }
}

const createYmaps = (collection: unknown) => {
  const makeConstructor = (kind: string) =>
    function (
      this: unknown,
      coordinates: unknown,
      properties: Record<string, unknown>,
      options: Record<string, unknown>,
    ) {
      return { kind, coordinates, properties, options }
    }

  const ymaps: Record<string, unknown> = {}
  ymaps.Placemark = makeConstructor('point')
  ymaps.Polyline = makeConstructor('line')
  ymaps.Polygon = makeConstructor('polygon')
  ymaps.GeoObjectCollection = function (this: unknown) {
    return collection
  }
  return ymaps
}

const createMap = (zoom: { value: number }, center: () => void) => ({
  geoObjects: { add: () => {} },
  events: { add: () => {}, remove: () => {} },
  getZoom: () => zoom.value,
  getCenter: () => [37.6, 55.7],
  setCenter: center,
})

const input = (
  notes: Note[],
  geometries: Record<string, { kind: 'Point'; coords: [number, number] }>,
) => ({
  notes,
  geometries,
  groups: [],
  hiddenIds: [] as string[],
  iconUrls: {},
})

describe('кластеры на слое', () => {
  let parts: ReturnType<typeof createCollection>
  let zoom: { value: number }

  beforeEach(() => {
    parts = createCollection()
    zoom = { value: 16 }
    ;(globalThis as { ymaps?: unknown }).ymaps = createYmaps(parts.collection)
  })

  afterEach(() => {
    delete (globalThis as { ymaps?: unknown }).ymaps
  })

  const twoClose = () =>
    input([makeNote({ id: 'a', name: 'Первая' }), makeNote({ id: 'b', name: 'Вторая' })], {
      a: { kind: 'Point', coords: [37.6, 55.7] },
      b: { kind: 'Point', coords: [37.6001, 55.7001] },
    })

  it('на дальнем зуме близкие точки дают один значок с числом', () => {
    zoom.value = 10
    const layer = new NotesLayer(() => createMap(zoom, () => {}) as never)

    layer.render(twoClose())

    expect(parts.objects).toHaveLength(1)
    const icon = parts.objects[0]
    expect(icon.properties.clusterNoteIds).toBe('a,b')
    expect(String(icon.options.iconImageHref)).toContain('2')
  })

  it('на близком зуме точки расходятся', () => {
    zoom.value = 16
    const layer = new NotesLayer(() => createMap(zoom, () => {}) as never)

    layer.render(twoClose())

    expect(parts.objects).toHaveLength(2)
    expect(parts.objects.every((object) => object.properties.noteId)).toBe(true)
  })

  it('порог кластеризации — последний зум с объединением', () => {
    zoom.value = CLUSTER_MAX_ZOOM
    const layer = new NotesLayer(() => createMap(zoom, () => {}) as never)
    layer.render(twoClose())
    expect(parts.objects).toHaveLength(1)

    parts.collection.removeAll()
    zoom.value = CLUSTER_MAX_ZOOM + 1
    layer.render(twoClose())
    expect(parts.objects).toHaveLength(2)
  })

  it('подписи заметок внутри кластера снимаются', () => {
    zoom.value = 10
    const layer = new NotesLayer(() => createMap(zoom, () => {}) as never)

    layer.render(
      input([makeNote({ id: 'a', showLabel: true }), makeNote({ id: 'b', showLabel: true })], {
        a: { kind: 'Point', coords: [37.6, 55.7] },
        b: { kind: 'Point', coords: [37.6001, 55.7001] },
      }),
    )

    // Остаться должен только значок: подписи двух точек иначе висели бы поверх.
    expect(parts.objects).toHaveLength(1)
    expect(parts.objects[0].properties.clusterNoteIds).toBe('a,b')
  })

  it('линии и полигоны не кластеризуются', () => {
    zoom.value = 7
    const layer = new NotesLayer(() => createMap(zoom, () => {}) as never)

    layer.render({
      notes: [
        makeNote({ id: 'line-1', kind: 'Line' }),
        makeNote({ id: 'poly-1', kind: 'Polygon' }),
      ],
      geometries: {
        'line-1': {
          kind: 'Line',
          coords: [
            [37.6, 55.7],
            [37.7, 55.8],
          ],
        },
        'poly-1': {
          kind: 'Polygon',
          coords: [
            [37.6, 55.7],
            [37.7, 55.7],
            [37.7, 55.8],
            [37.6, 55.7],
          ],
        },
      },
      groups: [],
      hiddenIds: [],
      iconUrls: {},
    })

    expect(parts.objects.map((object) => object.kind)).toEqual(['line', 'polygon'])
  })

  it('клик по значку приближает карту, а не выбирает заметку', () => {
    zoom.value = 10
    const setCenter = vi.fn()
    const selected: unknown[] = []
    document.addEventListener(NMAPS_NOTE_SELECTED_EVENT, (event) => {
      selected.push((event as CustomEvent).detail)
    })

    const layer = new NotesLayer(() => createMap(zoom, setCenter) as never)
    layer.render(twoClose())

    const cluster = parts.objects[0]
    const target = {
      properties: { get: (name: string) => cluster.properties[name] },
      geometry: { getCoordinates: () => cluster.coordinates },
    }
    parts.handlers[0]({ get: (name: string) => (name === 'target' ? target : undefined) })

    expect(setCenter).toHaveBeenCalled()
    expect(selected).toEqual([])
  })

  it('клик по обычной точке по-прежнему выбирает заметку', () => {
    zoom.value = 16
    const selected: unknown[] = []
    document.addEventListener(NMAPS_NOTE_SELECTED_EVENT, (event) => {
      selected.push((event as CustomEvent).detail)
    })

    const layer = new NotesLayer(() => createMap(zoom, () => {}) as never)
    layer.render(twoClose())

    const point = parts.objects[0]
    const target = {
      properties: { get: (name: string) => point.properties[name] },
    }
    parts.handlers[0]({ get: (name: string) => (name === 'target' ? target : undefined) })

    expect(selected).toEqual([{ noteId: 'a' }])
  })
})
