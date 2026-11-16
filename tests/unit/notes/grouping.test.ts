import { describe, expect, it } from 'vitest'
import { groupVisibility, sortGroups } from '@/lib/notes/model/grouping'
import type { NoteGroup } from '@/lib/notes/model/types'

/**
 * Правила групп в модели: порядок и видимость.
 *
 * Раскладка списка (строки, высоты, окно прокрутки) — интерфейс, её тесты в
 * `tests/unit/notes/panel_rows.test.ts`.
 */
const group = (overrides: Partial<NoteGroup> = {}): NoteGroup => ({
  id: 'g1',
  name: 'Мосты',
  color: '#1a8cff',
  order: 0,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

describe('sortGroups', () => {
  it('сортирует по order, затем по имени', () => {
    const groups = [
      group({ id: 'b', name: 'Б', order: 1 }),
      group({ id: 'a', name: 'А', order: 1 }),
      group({ id: 'z', name: 'Я', order: 0 }),
    ]

    expect(sortGroups(groups).map((item) => item.id)).toEqual(['z', 'a', 'b'])
  })
})

describe('видимость группы', () => {
  it('видна, если ничего не скрыто', () => {
    expect(groupVisibility(['a', 'b'], [])).toBe('visible')
  })

  it('скрыта, если скрыты все заметки', () => {
    expect(groupVisibility(['a', 'b'], ['a', 'b', 'c'])).toBe('hidden')
  })

  it('частично скрыта, если скрыта только часть', () => {
    expect(groupVisibility(['a', 'b'], ['a'])).toBe('mixed')
  })

  it('пустая группа считается видимой', () => {
    expect(groupVisibility([], ['a'])).toBe('visible')
  })
})
