/**
 * Заливка и штриховка полигонов.
 *
 * Проверяется то, что уходит в карту: прозрачность узора, базовая заливка и
 * признак тайлового повторения паттерна.
 */
import { describe, expect, it } from 'vitest'
import { NOTE_PALETTE } from '@/lib/notes/palette'
import { createDefaultStyle, resolveNoteStyle } from '@/lib/notes/style_resolution'
import type { Note, NoteStyle } from '@/lib/notes/types'
import { buildFillColor, buildHatchImageHref, renderNote } from '@/lib/notes_layer/objects'

const polygonNote = (style: Partial<NoteStyle> = {}, kind: Note['kind'] = 'Polygon'): Note => ({
  id: 'polygon-1',
  kind,
  name: 'Полигон',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: { ...createDefaultStyle('Polygon'), ...style },
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
})

const geometry = {
  kind: 'Polygon' as const,
  coords: [
    [37.6, 55.7],
    [37.7, 55.7],
    [37.7, 55.8],
    [37.6, 55.7],
  ] as [number, number][],
}

const renderPolygon = (style: Partial<NoteStyle> = {}) => {
  const [polygon] = renderNote({
    note: polygonNote(style),
    geometry,
    group: null,
    selected: false,
  })
  return polygon
}

describe('buildHatchImageHref', () => {
  it('без штриховки паттерна нет', () => {
    expect(buildHatchImageHref(resolveNoteStyle({ style: createDefaultStyle('Polygon') }))).toBe(
      undefined,
    )
  })

  it('рисует svg-паттерн в цвете штриховки', () => {
    const href = buildHatchImageHref(
      resolveNoteStyle({
        style: {
          ...createDefaultStyle('Polygon'),
          opacity: 1,
          hatch: { pattern: 'diagonal', color: NOTE_PALETTE[0], width: 2 },
        },
      }),
    )

    expect(href).toContain('data:image/svg+xml')
    expect(decodeURIComponent(String(href))).toContain('stroke="#e96b7c"')
  })

  it('учитывает прозрачность объекта в цвете узора', () => {
    const style = resolveNoteStyle({
      style: {
        ...createDefaultStyle('Polygon'),
        opacity: 0.5,
        hatch: { pattern: 'grid', color: NOTE_PALETTE[0], width: 2 },
      },
    })

    expect(decodeURIComponent(String(buildHatchImageHref(style)))).toContain('rgba(')
  })

  it('все пять узоров дают разный рисунок', () => {
    const patterns = ['diagonal', 'backDiagonal', 'grid', 'dots', 'horizontal'] as const
    const hrefs = patterns.map((pattern) =>
      buildHatchImageHref(
        resolveNoteStyle({
          style: {
            ...createDefaultStyle('Polygon'),
            hatch: { pattern, color: '#000000', width: 2 },
          },
        }),
      ),
    )

    expect(new Set(hrefs).size).toBe(patterns.length)
  })
})

describe('buildFillColor', () => {
  it('без заливки и без штриховки полигон прозрачный', () => {
    expect(
      buildFillColor(resolveNoteStyle({ style: polygonNote({ fillColor: null }).style })),
    ).toBe('rgba(0, 0, 0, 0)')
  })

  it('штриховка без заливки получает почти прозрачную основу', () => {
    const style = resolveNoteStyle({
      style: polygonNote({
        fillColor: null,
        hatch: { pattern: 'dots', color: '#000000', width: 1 },
      }).style,
    })

    expect(buildFillColor(style)).toBe('rgba(255, 255, 255, 0.001)')
  })

  it('заливка полупрозрачна относительно прозрачности объекта', () => {
    const style = resolveNoteStyle({
      style: polygonNote({ fillColor: '#1a8cff', opacity: 1 }).style,
    })

    expect(buildFillColor(style)).toBe('rgba(26, 140, 255, 0.5)')
  })
})

describe('renderNote: полигон', () => {
  it('заливка и штриховка попадают в опции карты', () => {
    const polygon = renderPolygon({
      fillColor: '#5aa845',
      hatch: { pattern: 'grid', color: '#1f1f1f', width: 2 },
    })

    expect(polygon.options.fill).toBe(true)
    expect(polygon.options.fillColor).toContain('rgba(90, 168, 69')
    expect(polygon.options.fillImageHref).toContain('data:image/svg+xml')
    expect(polygon.options.fillMethod).toBe('tile')
  })

  it('без штриховки паттерн не ставится', () => {
    const polygon = renderPolygon({ fillColor: '#5aa845', hatch: null })

    expect(polygon.options.fillImageHref).toBeUndefined()
    expect(polygon.options.fillMethod).toBeUndefined()
  })

  it('без заливки полигон остаётся только с обводкой', () => {
    const polygon = renderPolygon({ fillColor: null, hatch: null })

    expect(polygon.options.fillColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('квадрат и круг получают те же заливку и штриховку', () => {
    for (const kind of ['Square', 'Circle'] as const) {
      const [polygon] = renderNote({
        note: polygonNote(
          {
            fillColor: '#c44fa0',
            hatch: { pattern: 'diagonal', color: '#1f1f1f', width: 3 },
          },
          kind,
        ),
        geometry:
          kind === 'Square'
            ? {
                kind: 'Square',
                corners: [
                  [37.6, 55.7],
                  [37.8, 55.9],
                ],
              }
            : { kind: 'Circle', center: [37.6, 55.7], radiusMeters: 500 },
        group: null,
        selected: false,
      })

      expect(polygon.kind).toBe('polygon')
      expect(polygon.options.fillImageHref).toContain('data:image/svg+xml')
    }
  })

  it('у линии штриховки нет', () => {
    const [line] = renderNote({
      note: polygonNote(
        {
          fillColor: '#5aa845',
          hatch: { pattern: 'grid', color: '#1f1f1f', width: 2 },
        },
        'Line',
      ),
      geometry: {
        kind: 'Line',
        coords: [
          [37.6, 55.7],
          [37.7, 55.8],
        ],
      },
      group: null,
      selected: false,
    })

    expect(line.options.fillImageHref).toBeUndefined()
    expect(line.options.fillColor).toBeUndefined()
  })
})
