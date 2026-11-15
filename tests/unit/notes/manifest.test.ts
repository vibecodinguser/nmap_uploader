import { describe, expect, it } from 'vitest'
import {
  createEmptyManifest,
  mergeManifests,
  normalizeGeometry,
  normalizeNote,
  parseManifest,
} from '@/lib/notes/manifest'
import type { Note } from '@/lib/notes/types'

const baseNote = (overrides: Partial<Note> = {}): Note => ({
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

describe('parseManifest', () => {
  it('отбрасывает битые записи по одной, а не весь файл', () => {
    const manifest = parseManifest({
      version: 1,
      updatedAt: '2026-11-14T10:00:00.000Z',
      groups: [{ id: 'g1', name: 'Группа', color: '#1a8cff', order: 0 }],
      notes: [
        baseNote(),
        { id: 'broken', kind: 'Unknown', date: '14-11-2026' },
        { id: 'no-date', kind: 'Point' },
      ],
    })

    expect(manifest?.notes).toHaveLength(1)
    expect(manifest?.groups).toHaveLength(1)
  })

  it('возвращает null, если структура не похожа на манифест', () => {
    expect(parseManifest(null)).toBeNull()
    expect(parseManifest({ points: {} })).toBeNull()
  })

  it('нормализует прозрачность и ширину границы к допустимым значениям', () => {
    const note = normalizeNote(
      baseNote({
        style: { color: null, fillColor: null, hatch: null, opacity: 5, strokeWidth: 42 },
      }),
    )

    expect(note?.style.opacity).toBe(1)
    expect(note?.style.strokeWidth).toBe(8)
  })

  it('принимает старую штриховку без цвета и толщины', () => {
    // В записях до упрощения у узора были color и width: они больше не нужны.
    const note = normalizeNote({
      ...baseNote({ kind: 'Polygon' }),
      style: {
        color: null,
        fillColor: '#ffffff',
        hatch: { pattern: 'grid', color: '#000000', width: 2 },
        opacity: 1,
        strokeWidth: 3,
      },
    })

    expect(note?.style.hatch).toEqual({ pattern: 'grid' })
  })

  it('убирает штриховку у линий и точек', () => {
    const note = normalizeNote(
      baseNote({
        kind: 'Line',
        style: {
          color: null,
          fillColor: '#ffffff',
          hatch: { pattern: 'grid' },
          opacity: 1,
          strokeWidth: 3,
        },
      }),
    )

    expect(note?.style.hatch).toBeNull()
    expect(note?.style.fillColor).toBeNull()
  })
})

describe('mergeManifests', () => {
  it('побеждает более свежий updatedAt', () => {
    const remote = parseManifest({
      notes: [baseNote({ name: 'Старое', updatedAt: '2026-11-14T10:00:00.000Z' })],
    })
    const local = parseManifest({
      notes: [baseNote({ name: 'Новое', updatedAt: '2026-11-14T11:00:00.000Z' })],
    })

    const merged = mergeManifests(remote!, local!)
    expect(merged.notes[0].name).toBe('Новое')
  })

  it('не затирает серверную запись более старой локальной', () => {
    const remote = parseManifest({
      notes: [baseNote({ name: 'Свежее', updatedAt: '2026-11-14T12:00:00.000Z' })],
    })
    const local = parseManifest({
      notes: [baseNote({ name: 'Старое', updatedAt: '2026-11-14T09:00:00.000Z' })],
    })

    expect(mergeManifests(remote!, local!).notes[0].name).toBe('Свежее')
  })

  it('объединяет записи с разными id', () => {
    const remote = parseManifest({ notes: [baseNote({ id: 'a' })] })
    const local = parseManifest({ notes: [baseNote({ id: 'b' })] })

    expect(
      mergeManifests(remote!, local!)
        .notes.map((note) => note.id)
        .sort(),
    ).toEqual(['a', 'b'])
  })

  it('сортирует группы по order', () => {
    const remote = parseManifest({
      groups: [{ id: 'g2', name: 'Вторая', color: '#1a8cff', order: 2 }],
    })
    const local = parseManifest({
      groups: [{ id: 'g1', name: 'Первая', color: '#1a8cff', order: 1 }],
    })

    expect(mergeManifests(remote!, local!).groups.map((group) => group.id)).toEqual(['g1', 'g2'])
  })

  it('сливает манифест с пустым без потерь', () => {
    const remote = parseManifest({ notes: [baseNote()] })
    expect(mergeManifests(remote!, createEmptyManifest()).notes).toHaveLength(1)
  })
})

describe('normalizeGeometry', () => {
  it('замыкает незамкнутый полигон', () => {
    const geometry = normalizeGeometry({
      kind: 'Polygon',
      coords: [
        [37, 55],
        [38, 55],
        [38, 56],
      ],
    })

    expect(geometry?.kind).toBe('Polygon')
    expect(geometry && 'coords' in geometry ? geometry.coords.at(-1) : null).toEqual([37, 55])
  })

  it('отбрасывает вырожденные фигуры', () => {
    expect(normalizeGeometry({ kind: 'Line', coords: [[37, 55]] })).toBeNull()
    expect(normalizeGeometry({ kind: 'Circle', center: [37, 55], radiusMeters: 0 })).toBeNull()
    expect(normalizeGeometry({ kind: 'Square', corners: [[37, 55]] })).toBeNull()
  })
})
