// @vitest-environment happy-dom

/**
 * Подписи на слое карты.
 *
 * Проверяем связку: подписи не наезжают друг на друга, выбранная заметка
 * подписана первой, на малом зуме подписей нет вовсе.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Note } from '@/lib/notes/model/types'
import { NotesLayer } from '@/lib/notes_layer'
import { LABEL_MIN_ZOOM } from '@/lib/notes_layer/objects'

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Point',
  name: 'Точка',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: true,
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
}

const createCollection = () => {
  const objects: FakeObject[] = []
  return {
    objects,
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
      events: { add: () => {} },
    },
  }
}

const createYmaps = (collection: unknown) => {
  const makeConstructor = (kind: string) =>
    function (this: unknown, coordinates: unknown, properties: Record<string, unknown>) {
      return { kind, coordinates, properties }
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

const createMap = (zoom: { value: number }) => ({
  geoObjects: { add: () => {} },
  events: { add: () => {}, remove: () => {} },
  getZoom: () => zoom.value,
  getCenter: () => [37.6, 55.7],
})

describe('подписи на слое', () => {
  let parts: ReturnType<typeof createCollection>
  let zoom: { value: number }
  /** Одна и та же карта: иначе слой честно пересоздаёт коллекцию на каждый вызов. */
  let map: ReturnType<typeof createMap>

  beforeEach(() => {
    parts = createCollection()
    zoom = { value: 16 }
    map = createMap(zoom)
    ;(globalThis as { ymaps?: unknown }).ymaps = createYmaps(parts.collection)
  })

  afterEach(() => {
    delete (globalThis as { ymaps?: unknown }).ymaps
  })

  const labelsOf = (objects: FakeObject[]): string[] =>
    objects
      .filter((object) => object.kind === 'point' && 'iconContent' in object.properties)
      .map((object) => String(object.properties.noteId))

  /** Три заметки в одной точке: подписи гарантированно пересекаются. */
  const overlapping = () => ({
    notes: [
      makeNote({ id: 'note-1', name: 'Первая' }),
      makeNote({ id: 'note-2', name: 'Вторая' }),
      makeNote({ id: 'note-3', name: 'Третья' }),
    ],
    geometries: {
      'note-1': { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] },
      'note-2': { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] },
      'note-3': { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] },
    },
    groups: [],
    hiddenIds: [] as string[],
    iconUrls: {},
  })

  it('пересекающиеся подписи схлопываются до одной', () => {
    const layer = new NotesLayer(() => map as never)

    layer.render(overlapping())

    // Три объекта-заметки и всего одна подпись из трёх.
    expect(parts.objects).toHaveLength(4)
    expect(labelsOf(parts.objects)).toHaveLength(1)
  })

  it('выбранная заметка подписана первой', () => {
    const layer = new NotesLayer(() => map as never)
    layer.render(overlapping())

    layer.select('note-3')

    // После выбора подпись принадлежит выбранной заметке.
    expect(labelsOf(parts.objects)).toEqual(['note-3'])
  })

  it('на малом зуме подписей нет', () => {
    zoom.value = LABEL_MIN_ZOOM - 1
    const layer = new NotesLayer(() => map as never)

    layer.render(overlapping())

    expect(labelsOf(parts.objects)).toEqual([])
  })

  it('далёкие подписи показываются обе', () => {
    const layer = new NotesLayer(() => map as never)

    layer.render({
      notes: [makeNote({ id: 'a', name: 'Первая' }), makeNote({ id: 'b', name: 'Вторая' })],
      geometries: {
        a: { kind: 'Point', coords: [37.6, 55.7] },
        b: { kind: 'Point', coords: [39.6, 57.7] },
      },
      groups: [],
      hiddenIds: [],
      iconUrls: {},
    })

    expect(labelsOf(parts.objects).sort()).toEqual(['a', 'b'])
  })

  it('подписи не мигают: повторный рендер не пересоздаёт объекты', () => {
    const layer = new NotesLayer(() => map as never)
    layer.render(overlapping())
    const before = [...parts.objects]

    layer.render(overlapping())

    expect(parts.objects).toEqual(before)
  })
})
