// @vitest-environment happy-dom

/**
 * Перерисовка не должна трогать объекты, которые не изменились.
 *
 * Слой пересоздавал всю коллекцию на каждое изменение: правка названия или
 * шаг ползунка у одной заметки снимал с карты и заново ставил все остальные.
 * На карте это выглядит мерцанием всех объектов, а на тысяче заметок ещё и
 * заметно по времени.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

type CreatedObject = { kind: string; coordinates: unknown }

/** Коллекция, которая по-настоящему помнит свои объекты: так видно, что в ней осталось. */
const createCollection = () => {
  const objects: unknown[] = []
  return {
    objects,
    collection: {
      add: (object: unknown) => {
        objects.push(object)
      },
      remove: (object: unknown) => {
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

/**
 * Подмена ymaps.
 *
 * Ключи присваиваются по строке: конструкторы — обычные функции (стрелочная не
 * может быть конструктором), а литерал с заглавными ключами линтер принимает
 * за React-компонент.
 */
const createYmapsMock = () => {
  const created: CreatedObject[] = []
  const makeConstructor = (kind: string) =>
    function (this: unknown, coordinates: unknown) {
      const object = { kind, coordinates }
      created.push(object)
      return object
    }

  const ymaps: Record<string, unknown> = {}
  ymaps.Placemark = makeConstructor('point')
  ymaps.Polyline = makeConstructor('line')
  ymaps.Polygon = makeConstructor('polygon')
  ymaps.GeoObjectCollection = function (this: unknown) {
    return createCollection().collection
  }

  return { created, ymaps }
}

const createMapMock = () => ({
  geoObjects: { add: () => {} },
  events: { add: () => {}, remove: () => {} },
  getZoom: () => 16,
  getCenter: () => [37.6, 55.7],
})

const twoPoints = {
  notes: [makeNote({ id: 'note-1', name: 'Первая' }), makeNote({ id: 'note-2', name: 'Вторая' })],
  geometries: {
    'note-1': { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] },
    'note-2': { kind: 'Point' as const, coords: [38.6, 56.7] as [number, number] },
  },
  groups: [],
  hiddenIds: [] as string[],
  iconUrls: {},
}

describe('инкрементальная перерисовка', () => {
  let collection: ReturnType<typeof createCollection>
  /** Одна и та же карта: иначе слой честно пересоздаёт коллекцию на каждый рендер. */
  let map: ReturnType<typeof createMapMock>

  beforeEach(() => {
    collection = createCollection()
    map = createMapMock()
    const { ymaps } = createYmapsMock()
    ymaps.GeoObjectCollection = function (this: unknown) {
      return collection.collection
    }
    ;(globalThis as { ymaps?: unknown }).ymaps = ymaps
  })

  afterEach(() => {
    delete (globalThis as { ymaps?: unknown }).ymaps
  })

  it('правка одной заметки пересоздаёт только её объект', () => {
    const { created, ymaps } = createYmapsMock()
    ymaps.GeoObjectCollection = function (this: unknown) {
      return collection.collection
    }
    ;(globalThis as { ymaps?: unknown }).ymaps = ymaps

    const layer = new NotesLayer(() => map as never)
    layer.render(twoPoints)
    expect(created).toHaveLength(2)

    created.length = 0
    layer.render({
      ...twoPoints,
      notes: [
        makeNote({ id: 'note-1', name: 'Переименованная' }),
        makeNote({ id: 'note-2', name: 'Вторая' }),
      ],
    })

    // Точка — один объект; подписи выключены, поэтому второй объект не нужен.
    expect(created).toHaveLength(1)
    expect(collection.objects).toHaveLength(2)
  })

  it('неизменившийся объект остаётся тем же экземпляром', () => {
    const layer = new NotesLayer(() => map as never)
    layer.render(twoPoints)

    const before = [...collection.objects]
    layer.render({
      ...twoPoints,
      notes: [
        makeNote({ id: 'note-1', name: 'Переименованная' }),
        makeNote({ id: 'note-2', name: 'Вторая' }),
      ],
    })

    // Вторая точка не пересоздавалась: на карте это тот же объект.
    expect(collection.objects).toContain(before[1])
  })

  it('смена цвета не трогает остальные заметки', () => {
    const layer = new NotesLayer(() => map as never)
    layer.render(twoPoints)
    const before = [...collection.objects]

    layer.render({
      ...twoPoints,
      notes: [
        makeNote({
          id: 'note-1',
          name: 'Первая',
          style: { color: '#e96b7c', fillColor: null, hatch: null, opacity: 1, strokeWidth: 3 },
        }),
        makeNote({ id: 'note-2', name: 'Вторая' }),
      ],
    })

    expect(collection.objects).toHaveLength(2)
    expect(collection.objects).toContain(before[1])
    expect(collection.objects).not.toContain(before[0])
  })

  it('скрытая заметка уходит из коллекции, остальные остаются', () => {
    const layer = new NotesLayer(() => map as never)
    layer.render(twoPoints)
    const before = [...collection.objects]

    layer.render({ ...twoPoints, hiddenIds: ['note-1'] })

    expect(collection.objects).toHaveLength(1)
    expect(collection.objects).toContain(before[1])
  })

  it('повторный рендер без изменений не создаёт объектов', () => {
    const { created, ymaps } = createYmapsMock()
    ymaps.GeoObjectCollection = function (this: unknown) {
      return collection.collection
    }
    ;(globalThis as { ymaps?: unknown }).ymaps = ymaps

    const layer = new NotesLayer(() => map as never)
    layer.render(twoPoints)
    created.length = 0

    layer.render(twoPoints)
    layer.render(twoPoints)

    expect(created).toHaveLength(0)
    expect(collection.objects).toHaveLength(2)
  })

  it('смена карты пересоздаёт объекты в новой коллекции', () => {
    const layer = new NotesLayer(() => map as never)
    layer.render(twoPoints)

    const nextCollection = createCollection()
    collection = nextCollection
    // Карта пересоздана редактором: слой должен собрать объекты заново.
    map = createMapMock()

    layer.render(twoPoints)

    expect(nextCollection.objects).toHaveLength(2)
  })
})
