import { describe, expect, it } from 'vitest'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import {
  DEFAULT_NOTES_FILTER,
  filterNotes,
  GROUP_FILTER_ALL,
  GROUP_FILTER_NONE,
  hasActiveFilters,
  toggleKind,
} from '@/lib/notes/panel/filters'

/**
 * Фильтры и порядок списка — чистые функции, поэтому проверяются без DOM:
 * именно здесь решается, что пользователь увидит в списке.
 */
const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  kind: 'Point',
  name: 'Точка',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: { color: null, fillColor: null, hatch: null, opacity: 1, strokeWidth: 3 },
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

const group = (overrides: Partial<NoteGroup> = {}): NoteGroup => ({
  id: 'g1',
  name: 'Мосты',
  color: '#1a8cff',
  order: 0,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

const run = ({
  notes,
  groups = [],
  hiddenIds = [],
  query = '',
  filter = DEFAULT_NOTES_FILTER,
}: {
  notes: Note[]
  groups?: NoteGroup[]
  hiddenIds?: string[]
  query?: string
  filter?: typeof DEFAULT_NOTES_FILTER
}): string[] => filterNotes({ notes, groups, hiddenIds, query, filter }).map((item) => item.id)

const threeKinds = [
  note({ id: 'point', kind: 'Point', name: 'Точка' }),
  note({ id: 'line', kind: 'Line', name: 'Линия' }),
  note({ id: 'poly', kind: 'Polygon', name: 'Полигон' }),
]

describe('фильтр по виду', () => {
  it('пустой набор видов значит «все виды»', () => {
    expect(run({ notes: threeKinds })).toHaveLength(3)
  })

  it('оставляет выбранные виды', () => {
    expect(
      run({ notes: threeKinds, filter: { ...DEFAULT_NOTES_FILTER, kinds: ['Line'] } }),
    ).toEqual(['line'])
  })

  it('несколько видов объединяются', () => {
    // Порядок по умолчанию — по названию: «Полигон» раньше «Точки».
    expect(
      run({ notes: threeKinds, filter: { ...DEFAULT_NOTES_FILTER, kinds: ['Point', 'Polygon'] } }),
    ).toEqual(['poly', 'point'])
  })

  it('переключение вида добавляет и убирает его', () => {
    expect(toggleKind([], 'Circle')).toEqual(['Circle'])
    expect(toggleKind(['Circle'], 'Circle')).toEqual([])
    expect(toggleKind(['Point'], 'Circle')).toEqual(['Point', 'Circle'])
  })
})

describe('фильтр по группе', () => {
  const notes = [
    note({ id: 'in-group', groupId: 'g1' }),
    note({ id: 'in-root', groupId: null }),
    note({ id: 'orphan', groupId: 'deleted-group' }),
  ]

  it('«все группы» ничего не отсеивает', () => {
    expect(run({ notes, groups: [group()], filter: { ...DEFAULT_NOTES_FILTER } })).toHaveLength(3)
  })

  it('конкретная группа оставляет только её заметки', () => {
    expect(
      run({ notes, groups: [group()], filter: { ...DEFAULT_NOTES_FILTER, group: 'g1' } }),
    ).toEqual(['in-group'])
  })

  it('«без группы» включает и заметки с удалённой группой', () => {
    // Такие заметки список показывает в корне — фильтр обязан совпадать.
    expect(
      run({
        notes,
        groups: [group()],
        filter: { ...DEFAULT_NOTES_FILTER, group: GROUP_FILTER_NONE },
      }),
    ).toEqual(['in-root', 'orphan'])
  })

  it('значение по умолчанию — все группы', () => {
    expect(DEFAULT_NOTES_FILTER.group).toBe(GROUP_FILTER_ALL)
  })
})

describe('фильтр по видимости', () => {
  const notes = [note({ id: 'shown' }), note({ id: 'hidden' })]

  it('видимые — те, что не скрыты локально', () => {
    expect(
      run({
        notes,
        hiddenIds: ['hidden'],
        filter: { ...DEFAULT_NOTES_FILTER, visibility: 'visible' },
      }),
    ).toEqual(['shown'])
  })

  it('скрытые — только скрытые', () => {
    expect(
      run({
        notes,
        hiddenIds: ['hidden'],
        filter: { ...DEFAULT_NOTES_FILTER, visibility: 'hidden' },
      }),
    ).toEqual(['hidden'])
  })

  it('«все» не смотрит на скрытие', () => {
    expect(run({ notes, hiddenIds: ['hidden'] })).toHaveLength(2)
  })
})

describe('поиск вместе с фильтрами', () => {
  it('поиск и фильтр применяются одновременно', () => {
    const notes = [
      note({ id: 'a', kind: 'Point', name: 'Мост', description: '' }),
      note({ id: 'b', kind: 'Point', name: 'Дом', description: 'старый мост' }),
      note({ id: 'c', kind: 'Line', name: 'Мостовая', description: '' }),
    ]

    // Найдены обе точки, порядок — по названию: «Дом» раньше «Моста».
    expect(
      run({
        notes,
        query: 'мост',
        filter: { ...DEFAULT_NOTES_FILTER, kinds: ['Point'] },
      }),
    ).toEqual(['b', 'a'])
  })

  it('поиск не учитывает регистр и пробелы по краям', () => {
    expect(run({ notes: [note({ id: 'a', name: 'Мост' })], query: '  МОСТ ' })).toEqual(['a'])
  })
})

describe('сортировка', () => {
  const notes = [
    note({ id: 'b', name: 'Бетон', date: '01-12-2026' }),
    note({ id: 'a', name: 'Асфальт', date: '14-11-2026' }),
    note({ id: 'c', name: 'Вода', date: '05-01-2025' }),
  ]

  it('по названию: А–Я и Я–А', () => {
    expect(run({ notes })).toEqual(['a', 'b', 'c'])
    expect(run({ notes, filter: { ...DEFAULT_NOTES_FILTER, sort: 'nameDesc' } })).toEqual([
      'c',
      'b',
      'a',
    ])
  })

  it('по дате сравнивает календарь, а не строку', () => {
    // Строкой «01-12-2026» < «14-11-2026», но по календарю ноябрь раньше.
    expect(run({ notes, filter: { ...DEFAULT_NOTES_FILTER, sort: 'date' } })).toEqual([
      'c',
      'a',
      'b',
    ])
    expect(run({ notes, filter: { ...DEFAULT_NOTES_FILTER, sort: 'dateDesc' } })).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('при равной дате порядок по названию', () => {
    const sameDate = [
      note({ id: 'y', name: 'Яблоко', date: '14-11-2026' }),
      note({ id: 'a', name: 'Арбуз', date: '14-11-2026' }),
    ]

    expect(run({ notes: sameDate, filter: { ...DEFAULT_NOTES_FILTER, sort: 'date' } })).toEqual([
      'a',
      'y',
    ])
  })

  it('заметка с нечитаемой датой не ломает порядок', () => {
    const withBroken = [...notes, note({ id: 'broken', name: 'Без даты', date: 'не дата' })]

    expect(
      run({ notes: withBroken, filter: { ...DEFAULT_NOTES_FILTER, sort: 'date' } }),
    ).toHaveLength(4)
  })
})

describe('признак активных фильтров', () => {
  it('по умолчанию фильтров нет', () => {
    expect(hasActiveFilters(DEFAULT_NOTES_FILTER)).toBe(false)
  })

  it('любой вид, группа или видимость включают признак', () => {
    expect(hasActiveFilters({ ...DEFAULT_NOTES_FILTER, kinds: ['Point'] })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_NOTES_FILTER, group: 'g1' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_NOTES_FILTER, visibility: 'hidden' })).toBe(true)
    // Сортировка — не фильтр: список не сужается, и «ничего не найдено» не врёт.
    expect(hasActiveFilters({ ...DEFAULT_NOTES_FILTER, sort: 'dateDesc' })).toBe(false)
  })
})
