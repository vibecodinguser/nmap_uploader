import { describe, expect, it } from 'vitest'
import { calculateBoundingBox, formatNoteTime } from '@/lib/notes/geometry'

describe('Notes Geometry and Formatting (TDD slice)', () => {
  it('вычисляет BoundingBox [minLon, minLat, maxLon, maxLat] для полигона/линии', () => {
    const coords: [number, number][] = [
      [37.6, 55.7],
      [37.8, 55.9],
      [37.5, 55.6],
    ]

    const bbox = calculateBoundingBox(coords)
    expect(bbox).toEqual([37.5, 55.6, 37.8, 55.9])
  })

  it('возвращает undefined для пустых координат или одной точки', () => {
    expect(calculateBoundingBox([])).toBeUndefined()
    expect(calculateBoundingBox([[37.6, 55.7]])).toBeUndefined()
  })

  it('форматирует время заметки в HH:MM', () => {
    const date = new Date('2026-10-20T14:05:00')
    expect(formatNoteTime(date)).toBe('14:05')
  })
})
