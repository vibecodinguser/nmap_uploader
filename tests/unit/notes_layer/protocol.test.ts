import { describe, expect, it } from 'vitest'
import {
  parseGeometryDetail,
  parseLayerInput,
  parseNoteSelection,
} from '@/lib/notes_layer/protocol'

/**
 * Протокол между content script и MAIN-миром: данные едут строкой JSON в
 * `detail` события, поэтому разбор обязан переживать мусор, а не падать.
 */
const layerInput = {
  notes: [{ id: 'n1' }],
  geometries: { n1: { kind: 'Point', coords: [37, 55] } },
  groups: [],
  hiddenIds: ['n2', 42],
  iconUrls: { 'a.png': 'blob:1' },
}

describe('parseLayerInput', () => {
  it('разбирает JSON-строку события', () => {
    const parsed = parseLayerInput(JSON.stringify(layerInput))

    expect(parsed?.notes.map((note) => note.id)).toEqual(['n1'])
    expect(parsed?.hiddenIds).toEqual(['n2'])
    expect(parsed?.iconUrls).toEqual({ 'a.png': 'blob:1' })
  })

  it('принимает уже разобранный объект', () => {
    expect(parseLayerInput(layerInput)?.notes).toHaveLength(1)
  })

  it('битый JSON и неполные данные дают null', () => {
    expect(parseLayerInput('{')).toBeNull()
    expect(parseLayerInput(null)).toBeNull()
    expect(parseLayerInput(JSON.stringify({ notes: [] }))).toBeNull()
    expect(
      parseLayerInput(JSON.stringify({ notes: [], geometries: {}, groups: [] })),
    ).not.toBeNull()
  })

  it('отсутствующие скрытые id и иконки заменяются пустыми', () => {
    const parsed = parseLayerInput(JSON.stringify({ notes: [], geometries: {}, groups: [] }))

    expect(parsed?.hiddenIds).toEqual([])
    expect(parsed?.iconUrls).toEqual({})
  })
})

describe('parseNoteSelection', () => {
  it('различает снятый выбор, id и битое событие', () => {
    expect(parseNoteSelection(JSON.stringify({ noteId: null }))).toBeNull()
    expect(parseNoteSelection(JSON.stringify({ noteId: 'n1' }))).toBe('n1')
    expect(parseNoteSelection(JSON.stringify({ noteId: 42 }))).toBeUndefined()
    expect(parseNoteSelection('мусор')).toBeUndefined()
  })
})

describe('parseGeometryDetail', () => {
  it('нормализует геометрию и отбрасывает вырожденную', () => {
    expect(parseGeometryDetail(JSON.stringify({ kind: 'Point', coords: [37, 55] }))).toEqual({
      kind: 'Point',
      coords: [37, 55],
    })
    expect(parseGeometryDetail(JSON.stringify({ kind: 'Line', coords: [[37, 55]] }))).toBeNull()
    expect(parseGeometryDetail('{')).toBeNull()
  })
})
