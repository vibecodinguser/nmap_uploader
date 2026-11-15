import { describe, expect, it } from 'vitest'
import {
  buildListRows,
  collapseKey,
  GROUP_HEADER_HEIGHT,
  groupVisibility,
  NOTE_ROW_HEIGHT,
  positionRows,
  sortGroups,
  totalHeight,
  visibleSlice,
} from '@/lib/notes/grouping'
import type { Note, NoteGroup } from '@/lib/notes/types'

const group = (overrides: Partial<NoteGroup> = {}): NoteGroup => ({
  id: 'g1',
  name: 'Мосты',
  color: '#1a8cff',
  order: 0,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

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

const rows = (input: {
  notes: Note[]
  groups?: NoteGroup[]
  collapsed?: string[]
}): ReturnType<typeof buildListRows> =>
  buildListRows({
    notes: input.notes,
    groups: input.groups ?? [],
    collapsedGroupIds: input.collapsed ?? [],
    ungroupedTitle: 'Без группы',
  })

describe('sortGroups', () => {
  it('сортирует по order, затем по имени', () => {
    const ordered = sortGroups([
      group({ id: 'b', name: 'Б', order: 1 }),
      group({ id: 'a', name: 'А', order: 0 }),
      group({ id: 'c', name: 'А', order: 1 }),
    ])

    expect(ordered.map((item) => item.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('buildListRows', () => {
  it('без групп список плоский, лишнего заголовка нет', () => {
    const list = rows({ notes: [note({ id: 'a' }), note({ id: 'b' })] })

    expect(list.map((row) => row.type)).toEqual(['note', 'note'])
  })

  it('складывает заметки под заголовки своих групп', () => {
    const list = rows({
      notes: [
        note({ id: 'in', groupId: 'g1' }),
        note({ id: 'root' }),
        note({ id: 'other', groupId: 'g2' }),
      ],
      groups: [group({ id: 'g1', name: 'Мосты' }), group({ id: 'g2', name: 'Леса', order: 1 })],
    })

    expect(list.map((row) => (row.type === 'group' ? `#${row.title}` : row.note.id))).toEqual([
      '#Мосты',
      'in',
      '#Леса',
      'other',
      '#Без группы',
      'root',
    ])
  })

  it('свёрнутая группа скрывает свои заметки, но считает их', () => {
    const list = rows({
      notes: [note({ id: 'a', groupId: 'g1' }), note({ id: 'b', groupId: 'g1' })],
      groups: [group()],
      collapsed: [collapseKey('g1')],
    })

    expect(list).toHaveLength(2)
    const header = list[0]
    expect(header.type).toBe('group')
    expect(header.type === 'group' && header.notesCount).toBe(2)
    expect(header.type === 'group' && header.collapsed).toBe(true)
  })

  it('свёрнутый корень скрывает заметки без группы', () => {
    const list = rows({
      notes: [note({ id: 'root' })],
      groups: [group()],
      collapsed: [collapseKey(null)],
    })

    expect(list.filter((row) => row.type === 'note')).toHaveLength(0)
  })

  it('заметка с удалённой группой попадает в корень, а не исчезает', () => {
    const list = rows({
      notes: [note({ id: 'orphan', groupId: 'удалённая' })],
      groups: [group()],
    })

    const ungroupedHeader = list.find((row) => row.type === 'group' && row.groupId === null)
    expect(ungroupedHeader?.type === 'group' && ungroupedHeader.notesCount).toBe(1)
    expect(list.some((row) => row.type === 'note' && row.note.id === 'orphan')).toBe(true)
  })

  it('пустые группы не теряются', () => {
    const list = rows({ notes: [], groups: [group()] })

    expect(list.map((row) => row.type)).toEqual(['group', 'group'])
  })
})

describe('раскладка', () => {
  const list = rows({
    notes: [note({ id: 'a', groupId: 'g1' }), note({ id: 'b' })],
    groups: [group()],
  })

  it('считает высоту по типам строк', () => {
    // заголовок + заметка + заголовок «Без группы» + заметка
    expect(totalHeight(list)).toBe(GROUP_HEADER_HEIGHT * 2 + NOTE_ROW_HEIGHT * 2)
  })

  it('расставляет строки подряд без дыр', () => {
    const positioned = positionRows(list)

    expect(positioned.map((item) => item.top)).toEqual([0, 40, 96, 136])
    expect(positioned[3].top + positioned[3].height).toBe(totalHeight(list))
  })

  it('видимый срез не выходит за границы списка', () => {
    const positioned = positionRows(list)
    const { items } = visibleSlice(positioned, 0, 1000)

    expect(items).toHaveLength(list.length)
  })

  it('видимый срез работает и в середине списка', () => {
    const many = positionRows(
      rows({
        notes: Array.from({ length: 200 }, (_, index) => note({ id: `n${index}`, groupId: 'g1' })),
        groups: [group()],
      }),
    )
    const { items } = visibleSlice(many, 2000, 400)

    // Окно 400 px при строке 56 px — около 8 строк плюс запас.
    expect(items.length).toBeLessThan(30)
    expect(items[0].top).toBeLessThanOrEqual(2000)
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

  it('заголовки групп знают свои заметки', () => {
    const list = rows({
      notes: [note({ id: 'a', groupId: 'g1' }), note({ id: 'b' })],
      groups: [group()],
    })
    const groupRow = list[0]
    const rootRow = list[2]

    expect(groupRow.type === 'group' && groupRow.noteIds).toEqual(['a'])
    expect(rootRow.type === 'group' && rootRow.noteIds).toEqual(['b'])
  })
})
