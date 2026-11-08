import { describe, expect, it } from 'vitest'
import { applyNoteVisibility } from '@/lib/nmaps/note_visibility'

type FakeObject = {
  properties?: { get: (name: string) => unknown }
  geometry?: { getCoordinates: () => unknown }
  options?: { set: (name: string, value: unknown) => void; get: (name: string) => unknown }
  visible?: boolean
}

const createObject = (id: string | null, coordinates?: unknown): FakeObject => {
  const object: FakeObject = { visible: true }
  if (id) {
    object.properties = { get: (name) => (name === 'id' ? id : undefined) }
  }
  if (coordinates) {
    object.geometry = { getCoordinates: () => coordinates }
  }
  object.options = {
    set: (name, value) => {
      if (name === 'visible') object.visible = Boolean(value)
    },
    get: (name) => (name === 'visible' ? object.visible : undefined),
  }
  return object
}

const createCollection = (objects: FakeObject[]) => ({
  getLength: () => objects.length,
  get: (index: number) => objects[index],
})

describe('applyNoteVisibility', () => {
  it('скрывает объект по id из свойств', () => {
    const point = createObject('pt1')
    const map = { geoObjects: createCollection([point]) }

    applyNoteVisibility(
      { points: [{ id: 'pt1' }], snapTargets: [], hiddenIds: ['pt1'] },
      () => map as never,
    )

    expect(point.visible).toBe(false)
  })

  it('возвращает объект, если id больше не скрыт', () => {
    const point = createObject('pt1')
    const map = { geoObjects: createCollection([point]) }

    applyNoteVisibility(
      { points: [{ id: 'pt1' }], snapTargets: [], hiddenIds: [] },
      () => map as never,
    )

    expect(point.visible).toBe(true)
  })

  it('находит полигон по координатам, если id нет', () => {
    const polygon = createObject(null, [
      [
        [37.6, 55.7],
        [37.7, 55.7],
        [37.6, 55.7],
      ],
    ])
    const map = { geoObjects: createCollection([polygon]) }

    applyNoteVisibility(
      {
        points: [
          {
            id: 'poly-1',
            geomType: 'Polygon',
            geomCoords: [
              [37.6, 55.7],
              [37.7, 55.7],
              [37.6, 55.7],
            ],
          },
        ],
        snapTargets: [],
        hiddenIds: ['poly-1'],
      },
      () => map as never,
    )

    expect(polygon.visible).toBe(false)
  })

  it('обходит вложенные коллекции', () => {
    const point = createObject('pt1')
    const nested = createCollection([point])
    const map = { geoObjects: createCollection([nested as unknown as FakeObject]) }

    applyNoteVisibility(
      { points: [{ id: 'pt1' }], snapTargets: [], hiddenIds: ['pt1'] },
      () => map as never,
    )

    expect(point.visible).toBe(false)
  })

  it('ничего не делает без скрытых id', () => {
    const point = createObject('pt1')
    const map = { geoObjects: createCollection([point]) }

    applyNoteVisibility(
      { points: [{ id: 'pt1' }], snapTargets: [], hiddenIds: [] },
      () => map as never,
    )

    expect(point.visible).toBe(true)
  })
})
