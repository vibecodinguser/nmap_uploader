import { describe, expect, it } from 'vitest'
import { createDefaultStyle } from '@/lib/notes/model/style_resolution'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import { renderNote, renderNotes } from '@/lib/notes_layer/objects'

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

  it('не применяет прозрачность к иконке точки', () => {
    const [point] = renderNote({
      note: note({
        style: { ...createDefaultStyle('Point'), color: '#e96b7c', opacity: 0.5 },
      }),
      geometry: { kind: 'Point', coords: [37, 55] },
      group: null,
      selected: false,
    })

    const href = decodeURIComponent(String(point.options.iconImageHref))
    // Полупрозрачный цвет остался бы в данных без способа его исправить:
    // у точки ползунка прозрачности нет.
    expect(href).toContain('fill="#e96b7c"')
    expect(href).not.toContain('rgba(')
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

describe('иконка заметки', () => {
  it('встроенная иконка заменяет кружок у точки', () => {
    const [point] = renderNote({
      note: note({
        icon: { kind: 'builtin', value: 'flag' },
        style: { ...createDefaultStyle('Point'), color: '#e96b7c' },
      }),
      geometry: { kind: 'Point', coords: [37, 55] },
      group: null,
      selected: false,
    })

    const href = decodeURIComponent(String(point.options.iconImageHref))
    expect(href).toContain('stroke="#e96b7c"')
    // Кружок рисуется другим сборщиком: в иконке нет заливки круга.
    expect(href).not.toContain('fill="#ffffff" fill-opacity="0.9"')
  })

  it('без иконки точка остаётся кружком', () => {
    const [point] = renderNote({
      note: note(),
      geometry: { kind: 'Point', coords: [37, 55] },
      group: null,
      selected: false,
    })

    expect(String(point.options.iconImageHref)).toContain('%23ffffff')
  })

  it('у линии иконка стоит в центре отдельным объектом', () => {
    const rendered = renderNote({
      note: note({ id: 'line-1', kind: 'Line', icon: { kind: 'builtin', value: 'route' } }),
      geometry: {
        kind: 'Line',
        coords: [
          [37, 55],
          [38, 56],
        ],
      },
      group: null,
      selected: false,
    })

    const icon = rendered.find((item) => item.kind === 'icon')
    expect(icon).toBeDefined()
    expect(icon?.coordinates).toEqual([37.5, 55.5])
    // Линия рисуется как прежде: иконка заметки её не заменяет.
    expect(rendered.some((item) => item.kind === 'line')).toBe(true)
  })

  it('у полигона иконка стоит в центре и не мешает заливке', () => {
    const rendered = renderNote({
      note: note({
        id: 'poly-1',
        kind: 'Polygon',
        icon: { kind: 'builtin', value: 'trees' },
        style: { ...createDefaultStyle('Polygon'), color: '#5aa845', fillColor: '#5aa845' },
      }),
      geometry: {
        kind: 'Polygon',
        coords: [
          [37, 55],
          [38, 55],
          [38, 56],
          [37, 56],
          [37, 55],
        ],
      },
      group: null,
      selected: false,
    })

    const polygon = rendered.find((item) => item.kind === 'polygon')
    const icon = rendered.find((item) => item.kind === 'icon')

    expect(icon).toBeDefined()
    expect(polygon?.options.fillImageHref).toBeUndefined()
    expect(String(polygon?.options.fillColor)).toContain('rgba(90, 168, 69')
  })

  it('без иконки у линии и полигона объекта иконки нет', () => {
    const rendered = renderNote({
      note: note({ id: 'line-1', kind: 'Line' }),
      geometry: {
        kind: 'Line',
        coords: [
          [37, 55],
          [38, 56],
        ],
      },
      group: null,
      selected: false,
    })

    expect(rendered.some((item) => item.kind === 'icon')).toBe(false)
  })

  it('неизвестный id встроенной иконки не рисуется', () => {
    const rendered = renderNote({
      note: note({ id: 'line-1', kind: 'Line', icon: { kind: 'builtin', value: 'no-such' } }),
      geometry: {
        kind: 'Line',
        coords: [
          [37, 55],
          [38, 56],
        ],
      },
      group: null,
      selected: false,
    })

    expect(rendered.some((item) => item.kind === 'icon')).toBe(false)
  })

  it('файловая иконка берётся из iconUrls и работает у любой фигуры', () => {
    const rendered = renderNote({
      note: note({
        id: 'poly-1',
        kind: 'Polygon',
        icon: { kind: 'file', value: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png' },
      }),
      geometry: {
        kind: 'Polygon',
        coords: [
          [37, 55],
          [38, 55],
          [38, 56],
          [37, 55],
        ],
      },
      group: null,
      selected: false,
      iconUrls: { 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png': 'data:image/png;base64,AAA' },
    })

    const icon = rendered.find((item) => item.kind === 'icon')
    expect(icon?.options.iconImageHref).toBe('data:image/png;base64,AAA')
  })
})

describe('детализация контуров по зуму', () => {
  /** Ломаная из 200 вершин: на дальнем зуме её надо проредить. */
  const wavyLine = Array.from({ length: 200 }, (_, index) => {
    const t = index / 200
    return [37.6 + t * 0.02, 55.7 + Math.sin(t * 40) * 0.0008] as [number, number]
  })

  it('на дальнем зуме линия отдаёт меньше вершин', () => {
    const [far] = renderNote({
      note: note({ id: 'line-1', kind: 'Line' }),
      geometry: { kind: 'Line', coords: wavyLine },
      group: null,
      selected: false,
      zoom: 8,
    })

    expect((far.coordinates as number[][]).length).toBeLessThan(wavyLine.length)
  })

  it('на крупном зуме линия отдаётся целиком', () => {
    const [near] = renderNote({
      note: note({ id: 'line-1', kind: 'Line' }),
      geometry: { kind: 'Line', coords: wavyLine },
      group: null,
      selected: false,
      zoom: 17,
    })

    expect((near.coordinates as number[][]).length).toBe(wavyLine.length)
  })

  it('без зума поведение прежнее: контур целиком', () => {
    const [line] = renderNote({
      note: note({ id: 'line-1', kind: 'Line' }),
      geometry: { kind: 'Line', coords: wavyLine },
      group: null,
      selected: false,
    })

    expect((line.coordinates as number[][]).length).toBe(wavyLine.length)
  })

  it('полигон на дальнем зуме упрощается, но остаётся замкнутым', () => {
    const dense: [number, number][] = []
    for (let index = 0; index <= 400; index += 1) {
      const angle = (2 * Math.PI * index) / 400
      dense.push([37.6 + Math.cos(angle) * 0.01, 55.7 + Math.sin(angle) * 0.01])
    }

    const [polygon] = renderNote({
      note: note({ id: 'poly-1', kind: 'Polygon' }),
      geometry: { kind: 'Polygon', coords: dense },
      group: null,
      selected: false,
      zoom: 8,
    })

    const ring = (polygon.coordinates as [number, number][][])[0]
    expect(ring.length).toBeLessThan(dense.length)
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it('большой круг на дальнем зуме сохраняет форму', () => {
    const [circle] = renderNote({
      note: note({ id: 'circle-1', kind: 'Circle' }),
      geometry: { kind: 'Circle', center: [37.6, 55.7], radiusMeters: 20_000 },
      group: null,
      selected: false,
      zoom: 8,
    })

    const ring = (circle.coordinates as [number, number][][])[0]
    // Контур должен остаться многоугольником, а не превратиться в треугольник.
    expect(ring.length).toBeGreaterThan(8)
  })

  it('крошечный круг на дальнем зуме схлопывается: он меньше пикселя', () => {
    const [circle] = renderNote({
      note: note({ id: 'circle-1', kind: 'Circle' }),
      geometry: { kind: 'Circle', center: [37.6, 55.7], radiusMeters: 250 },
      group: null,
      selected: false,
      zoom: 8,
    })

    const ring = (circle.coordinates as [number, number][][])[0]
    // Это не потеря данных: 250 м на зуме 8 — доли пикселя, форма не видна.
    expect(ring.length).toBeGreaterThanOrEqual(3)
  })
})
