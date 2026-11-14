import { describe, expect, it } from 'vitest'
import { createDefaultStyle, resolveNoteStyle } from '@/lib/notes/style_resolution'
import type { Note, NoteGroup } from '@/lib/notes/types'
import { buildHatchImageHref, renderNote, renderNotes } from '@/lib/notes_layer/objects'

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Point',
  name: 'Точка',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: createDefaultStyle('Point'),
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

const group: NoteGroup = {
  id: 'group-1',
  name: 'Группа',
  color: '#5aa845',
  order: 0,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
}

describe('renderNote', () => {
  it('рисует точку svg-иконкой с цветом заметки', () => {
    const [point] = renderNote({
      note: note({ style: { ...createDefaultStyle('Point'), color: '#e96b7c' } }),
      geometry: { kind: 'Point', coords: [37, 55] },
      group: null,
      selected: false,
    })

    expect(point.kind).toBe('point')
    expect(String(point.options.iconImageHref)).toContain('data:image/svg+xml')
    expect(String(point.options.iconImageHref)).toContain('%23e96b7c')
  })

  it('добавляет подпись отдельным объектом, если она включена', () => {
    const rendered = renderNote({
      note: note({ name: 'Мост', showLabel: true }),
      geometry: { kind: 'Point', coords: [37, 55] },
      group: null,
      selected: false,
    })

    expect(rendered).toHaveLength(2)
    expect(rendered[1].kind).toBe('label')
    expect(rendered[1].properties.iconContent).toBe('Мост')
  })

  it('без названия подпись не создаётся', () => {
    const rendered = renderNote({
      note: note({ name: '   ', showLabel: true }),
      geometry: { kind: 'Point', coords: [37, 55] },
      group: null,
      selected: false,
    })

    expect(rendered).toHaveLength(1)
  })

  it('для линии берёт цвет группы', () => {
    const [line] = renderNote({
      note: note({ kind: 'Line', groupId: 'group-1' }),
      geometry: {
        kind: 'Line',
        coords: [
          [37, 55],
          [38, 56],
        ],
      },
      group,
      selected: false,
    })

    expect(line.options.strokeColor).toBe('#5aa845')
  })

  it('утолщает границу выбранной заметки', () => {
    const base = createDefaultStyle('Line')
    const [line] = renderNote({
      note: note({ kind: 'Line', style: { ...base, strokeWidth: 3 } }),
      geometry: {
        kind: 'Line',
        coords: [
          [37, 55],
          [38, 56],
        ],
      },
      group: null,
      selected: true,
    })

    expect(line.options.strokeWidth).toBe(5)
  })

  it('круг приводит к кольцу полигона', () => {
    const [polygon] = renderNote({
      note: note({ kind: 'Circle', style: createDefaultStyle('Circle') }),
      geometry: { kind: 'Circle', center: [37, 55], radiusMeters: 500 },
      group: null,
      selected: false,
    })

    expect(polygon.kind).toBe('polygon')
    expect((polygon.coordinates as number[][][]).length).toBe(1)
  })

  it('квадрат строится из двух углов', () => {
    const [polygon] = renderNote({
      note: note({ kind: 'Square', style: createDefaultStyle('Square') }),
      geometry: {
        kind: 'Square',
        corners: [
          [37, 55],
          [38, 56],
        ],
      },
      group: null,
      selected: false,
    })

    expect((polygon.coordinates as number[][][])[0]).toHaveLength(5)
  })

  it('штриховка превращается в svg-паттерн', () => {
    const style = resolveNoteStyle({
      style: {
        ...createDefaultStyle('Polygon'),
        hatch: { pattern: 'diagonal', color: '#000000', width: 2 },
      },
    })

    expect(buildHatchImageHref(style)).toContain('data:image/svg+xml')
  })

  it('без штриховки паттерна нет', () => {
    expect(buildHatchImageHref(resolveNoteStyle({ style: createDefaultStyle('Polygon') }))).toBe(
      undefined,
    )
  })
})

describe('renderNotes', () => {
  it('пропускает скрытые и без геометрии', () => {
    const rendered = renderNotes({
      notes: [note({ id: 'a' }), note({ id: 'b' })],
      geometries: { a: { kind: 'Point', coords: [37, 55] } },
      groups: [],
      hiddenIds: [],
      selectedId: null,
    })

    expect(rendered).toHaveLength(1)
    expect(rendered[0].id).toBe('a')
  })

  it('не рисует объекты из списка скрытых', () => {
    const rendered = renderNotes({
      notes: [note({ id: 'a' })],
      geometries: { a: { kind: 'Point', coords: [37, 55] } },
      groups: [],
      hiddenIds: ['a'],
      selectedId: null,
    })

    expect(rendered).toEqual([])
  })
})
