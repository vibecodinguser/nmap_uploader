import { describe, expect, it } from 'vitest'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import {
  buildListRows,
  collapseKey,
  GROUP_HEADER_HEIGHT,
  NOTE_ROW_HEIGHT,
  positionRows,
  pruneCollapsedKeys,
  totalHeight,
  visibleSlice,
} from '@/lib/notes/panel/rows'

/**
 * Раскладка списка заметок: заголовки групп, заметки под ними, высоты и окно
 * прокрутки. Всё это нужно только интерфейсу, поэтому живёт в `panel/rows`, а
 * не в модели — и тесты здесь, а не в `grouping.test.ts`.
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

describe('buildListRows', () => {
  it('без групп список плоский, лишнего заголовка нет', () => {
    const list = rows({ notes: [note({ id: 'a' }), note({ id: 'b' })] })

    expect(list.every((row) => row.type === 'note')).toBe(true)
  })

  it('складывает заметки под заголовки своих групп', () => {
    const list = rows({
      notes: [note({ id: 'a', groupId: 'g1' }), note({ id: 'b' })],
      groups: [group()],
    })

    expect(list.map((row) => (row.type === 'group' ? row.groupId : row.note.id))).toEqual([
      'g1',
      'a',
      null,
      'b',
    ])
  })

  it('свёрнутая группа скрывает свои заметки, но считает их', () => {
    const list = rows({
      notes: [note({ id: 'a', groupId: 'g1' })],
      groups: [group()],
      collapsed: ['g1'],
    })
    const header = list[0]

    expect(list.filter((row) => row.type === 'note')).toHaveLength(0)
    expect(header.type === 'group' && header.notesCount).toBe(1)
  })

  it('свёрнутый корень скрывает заметки без группы', () => {
    const list = rows({
      notes: [note({ id: 'b' })],
      groups: [group()],
      collapsed: [collapseKey(null)],
    })

    expect(list.filter((row) => row.type === 'note')).toHaveLength(0)
  })

  it('заметка с удалённой группой попадает в корень, а не исчезает', () => {
    const list = rows({
      notes: [note({ id: 'a', groupId: 'deleted' })],
      groups: [group()],
    })

    expect(
      list.filter((row) => row.type === 'note').map((row) => row.type === 'note' && row.note.id),
    ).toEqual(['a'])
  })

  it('пустые группы не теряются', () => {
    const list = rows({ notes: [], groups: [group()] })

    expect(list.filter((row) => row.type === 'group')).toHaveLength(2)
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

    // Считаем от констант, а не от литералов: высоты строк связаны с CSS и
    // меняются вместе с ним.
    expect(positioned.map((item) => item.top)).toEqual([
      0,
      GROUP_HEADER_HEIGHT,
      GROUP_HEADER_HEIGHT + NOTE_ROW_HEIGHT,
      GROUP_HEADER_HEIGHT * 2 + NOTE_ROW_HEIGHT,
    ])
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

describe('pruneCollapsedKeys', () => {
  it('оставляет ключи существующих групп и корень', () => {
    expect(pruneCollapsedKeys(['', 'g1'], ['g1', 'g2'])).toEqual(['', 'g1'])
  })

  it('выбрасывает id удалённой группы', () => {
    // Иначе после роспуска групп их id висели бы в настройках навсегда.
    expect(pruneCollapsedKeys(['g1', 'g9'], ['g1'])).toEqual(['g1'])
  })

  it('корень сохраняется всегда: он не привязан к группе', () => {
    expect(pruneCollapsedKeys([''], [])).toEqual([''])
  })

  it('убирает повторы', () => {
    expect(pruneCollapsedKeys(['g1', 'g1'], ['g1'])).toEqual(['g1'])
  })
})
