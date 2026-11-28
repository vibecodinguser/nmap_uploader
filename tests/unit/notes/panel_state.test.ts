import { describe, expect, it } from 'vitest'
import type { NoteGeometry } from '@/lib/notes/model/types'
import { notesPanelReducer } from '@/lib/notes/panel/reducer'
import {
  selectFilteredNotes,
  selectGeometries,
  selectGeometry,
  selectGroups,
  selectHasNarrowing,
  selectHiddenIds,
  selectNotes,
  selectSelectedNote,
} from '@/lib/notes/panel/selectors'
import { initialNotesPanelState } from '@/lib/notes/panel/state'
import type { NotesSnapshot } from '@/lib/notes/protocol'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

const point: NoteGeometry = { kind: 'Point', coords: [37.6, 55.7] }

const snapshot = (overrides: Partial<NotesSnapshot> = {}): NotesSnapshot => ({
  manifest: {
    version: 1,
    updatedAt: '2026-11-14T10:00:00.000Z',
    groups: [],
    deletedNotes: [],
    notes: [],
  },
  shards: {},
  hiddenIds: [],
  ...overrides,
})

const ready = (state: NotesSnapshot) =>
  notesPanelReducer(initialNotesPanelState, {
    type: 'loaded',
    snapshot: state,
  })

describe('редьюсер панели: снимок', () => {
  it('загрузка снимает ошибку и включает готовность', () => {
    const state = notesPanelReducer(
      { ...initialNotesPanelState, error: 'STORAGE_ERROR', status: 'error' },
      { type: 'loaded', snapshot: snapshot() },
    )

    expect(state.status).toBe('ready')
    expect(state.error).toBeNull()
    expect(state.snapshot).not.toBeNull()
  })

  it('широковещательный снимок не откатывает более свежую локальную правку', () => {
    const local = ready(
      snapshot({
        manifest: {
          version: 1,
          updatedAt: 'x',
          groups: [],
          deletedNotes: [],
          notes: [
            sampleNote({ id: 'n1', name: 'Локальная', updatedAt: '2026-11-14T12:00:00.000Z' }),
          ],
        },
      }),
    )
    const incoming = snapshot({
      manifest: {
        version: 1,
        updatedAt: 'x',
        groups: [],
        deletedNotes: [],
        notes: [sampleNote({ id: 'n1', name: 'Серверная', updatedAt: '2026-11-14T11:00:00.000Z' })],
      },
    })

    const state = notesPanelReducer(local, { type: 'merged', snapshot: incoming })

    expect(selectNotes(state)[0]?.name).toBe('Локальная')
    expect(state.status).toBe('ready')
  })

  it('снимок с надгробием убирает заметку, удалённую на другом устройстве', () => {
    // Панель на устройстве B держит заметку, устройство A её удалило.
    const local = ready(
      snapshot({
        manifest: {
          version: 1,
          updatedAt: 'x',
          groups: [],
          notes: [sampleNote({ id: 'note-1', updatedAt: '2026-11-16T10:00:00.000Z' })],
          deletedNotes: [],
        },
      }),
    )
    const incoming = snapshot({
      manifest: {
        version: 1,
        updatedAt: 'x',
        groups: [],
        notes: [],
        deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T12:00:00.000Z' }],
      },
    })

    const state = notesPanelReducer(local, { type: 'merged', snapshot: incoming })

    expect(selectNotes(state)).toEqual([])
    expect(state.snapshot?.manifest.deletedNotes.map((tombstone) => tombstone.id)).toEqual([
      'note-1',
    ])
  })

  it('снимок без надгробия не воскрешает локальную правку', () => {
    const local = ready(
      snapshot({
        manifest: {
          version: 1,
          updatedAt: 'x',
          groups: [],
          notes: [
            sampleNote({ id: 'note-1', name: 'Правка', updatedAt: '2026-11-16T13:00:00.000Z' }),
          ],
          deletedNotes: [],
        },
      }),
    )
    const incoming = snapshot({
      manifest: {
        version: 1,
        updatedAt: 'x',
        groups: [],
        notes: [
          sampleNote({ id: 'note-1', name: 'Старое', updatedAt: '2026-11-16T10:00:00.000Z' }),
        ],
        deletedNotes: [],
      },
    })

    const state = notesPanelReducer(local, { type: 'merged', snapshot: incoming })

    expect(selectNotes(state)[0]?.name).toBe('Правка')
  })

  it('очистка сбрасывает выбор и историю отмены', () => {
    const state = notesPanelReducer(
      {
        ...ready(snapshot()),
        selectedId: 'n1',
        undo: { note: sampleNote(), geometry: point },
        mode: 'properties',
      },
      { type: 'snapshotCleared' },
    )

    expect(state.snapshot).toBeNull()
    expect(state.selectedId).toBeNull()
    expect(state.undo).toBeNull()
    expect(state.mode).toBe('list')
  })

  /*
   * Заметку могли удалить на другом устройстве, пока панель стояла в её
   * свойствах. Выбранный id тогда указывает в пустоту: карточка не рисуется,
   * список тоже — панель выглядит пустой.
   */
  it('свежий снимок снимает выбор заметки, которой в нём нет', () => {
    const state = notesPanelReducer(
      { ...ready(snapshot()), selectedId: 'n1', mode: 'properties' },
      { type: 'loaded', snapshot: snapshot() },
    )

    expect(state.selectedId).toBeNull()
    expect(state.mode).toBe('list')
  })

  it('свежий снимок сохраняет выбор существующей заметки', () => {
    const withNote = snapshot({
      manifest: {
        version: 1,
        updatedAt: '2026-11-14T10:00:00.000Z',
        groups: [],
        deletedNotes: [],
        notes: [sampleNote({ id: 'n1' })],
      },
    })
    const state = notesPanelReducer(
      { ...ready(withNote), selectedId: 'n1', mode: 'properties' },
      { type: 'loaded', snapshot: withNote },
    )

    expect(state.selectedId).toBe('n1')
    expect(state.mode).toBe('properties')
  })

  it('патч заменяет манифест и только затронутый шард', () => {
    const state = notesPanelReducer(
      ready(
        snapshot({
          shards: {
            '2026-10': { version: 1, updatedAt: 'old', notes: {} },
            '2026-11': { version: 1, updatedAt: 'old', notes: {} },
          },
        }),
      ),
      {
        type: 'patchApplied',
        patch: {
          manifest: {
            version: 1,
            updatedAt: 'new',
            groups: [],
            notes: [sampleNote({ id: 'n1' })],
            deletedNotes: [],
          },
          shards: { '2026-11': { version: 1, updatedAt: 'new', notes: { n1: point } } },
        },
      },
    )

    expect(selectNotes(state).map((note) => note.id)).toEqual(['n1'])
    expect(state.snapshot?.shards['2026-10']?.updatedAt).toBe('old')
    expect(state.snapshot?.shards['2026-11']?.updatedAt).toBe('new')
  })
})

describe('редьюсер панели: заметки', () => {
  it('добавление кладёт геометрию в шард по месяцу и открывает свойства', () => {
    const state = notesPanelReducer(ready(snapshot()), {
      type: 'noteAdded',
      note: sampleNote({ id: 'n1', date: '14-11-2026' }),
      geometry: point,
    })

    expect(selectNotes(state).map((note) => note.id)).toEqual(['n1'])
    expect(state.snapshot?.shards['2026-11']?.notes.n1).toEqual(point)
    expect(state.selectedId).toBe('n1')
    expect(state.mode).toBe('properties')
  })

  it('добавление заметки с нечитаемой датой не создаёт шард', () => {
    const state = notesPanelReducer(ready(snapshot()), {
      type: 'noteAdded',
      note: sampleNote({ id: 'n1', date: 'не дата' }),
      geometry: point,
    })

    expect(state.snapshot?.shards).toEqual({})
    expect(selectNotes(state).map((note) => note.id)).toEqual(['n1'])
  })

  it('правка меняет атрибуты и не трогает геометрию', () => {
    const prepared = notesPanelReducer(ready(snapshot()), {
      type: 'noteAdded',
      note: sampleNote({ id: 'n1' }),
      geometry: point,
    })

    const state = notesPanelReducer(prepared, {
      type: 'notePatched',
      note: sampleNote({ id: 'n1', name: 'Новое имя' }),
    })

    expect(selectNotes(state)[0]?.name).toBe('Новое имя')
    expect(selectGeometries(state).n1).toEqual(point)
  })

  it('удаление убирает строку и снимает выбор, геометрию оставляет снимку', () => {
    const prepared = notesPanelReducer(ready(snapshot()), {
      type: 'noteAdded',
      note: sampleNote({ id: 'n1' }),
      geometry: point,
    })

    const state = notesPanelReducer(prepared, { type: 'noteRemoved', noteId: 'n1' })

    expect(selectNotes(state)).toEqual([])
    expect(state.selectedId).toBeNull()
    expect(state.mode).toBe('list')
    // Геометрия уедет следующим снимком с Диска: локально её не вычищаем.
    expect(selectGeometries(state).n1).toEqual(point)
  })

  it('возврат удалённой заметки восстанавливает её и закрывает отмену', () => {
    const state = notesPanelReducer(ready(snapshot()), {
      type: 'noteRestored',
      entry: { note: sampleNote({ id: 'n1' }), geometry: point },
    })

    expect(selectNotes(state).map((note) => note.id)).toEqual(['n1'])
    expect(selectGeometries(state).n1).toEqual(point)
    expect(state.undo).toBeNull()
  })

  it('перенос ставит группу и новый updatedAt', () => {
    const prepared = notesPanelReducer(ready(snapshot()), {
      type: 'noteAdded',
      note: sampleNote({ id: 'n1' }),
      geometry: point,
    })

    const state = notesPanelReducer(prepared, {
      type: 'noteMoved',
      noteId: 'n1',
      groupId: 'group-1',
      updatedAt: '2026-11-15T10:00:00.000Z',
    })

    expect(selectNotes(state)[0]?.groupId).toBe('group-1')
    expect(selectNotes(state)[0]?.updatedAt).toBe('2026-11-15T10:00:00.000Z')
  })
})

describe('редьюсер панели: группы', () => {
  const withGroup = () =>
    notesPanelReducer(
      notesPanelReducer(ready(snapshot()), {
        type: 'noteAdded',
        note: sampleNote({ id: 'n1', groupId: 'group-1' }),
        geometry: point,
      }),
      { type: 'groupSaved', group: sampleGroup() },
    )

  it('сохранение создаёт группу, повторное — обновляет', () => {
    const created = withGroup()
    expect(created.snapshot?.manifest.groups.map((group) => group.id)).toEqual(['group-1'])

    const renamed = notesPanelReducer(created, {
      type: 'groupSaved',
      group: sampleGroup({ name: 'Переименованная' }),
    })
    expect(renamed.snapshot?.manifest.groups).toHaveLength(1)
    expect(renamed.snapshot?.manifest.groups[0]?.name).toBe('Переименованная')
  })

  it('распуск группы оставляет заметки в корне', () => {
    const state = notesPanelReducer(withGroup(), {
      type: 'groupRemoved',
      groupId: 'group-1',
      mode: 'keepNotes',
    })

    expect(state.snapshot?.manifest.groups).toEqual([])
    expect(selectNotes(state)[0]?.groupId).toBeNull()
    expect(selectNotes(state)).toHaveLength(1)
  })

  it('каскадное удаление группы удаляет и заметки', () => {
    const state = notesPanelReducer(withGroup(), {
      type: 'groupRemoved',
      groupId: 'group-1',
      mode: 'cascade',
    })

    expect(selectNotes(state)).toEqual([])
    expect(state.selectedId).toBeNull()
  })
})

describe('редьюсер панели: режимы и мелочи', () => {
  it('выбор заметки переключает режим, снятие выбора возвращает список', () => {
    const selected = notesPanelReducer(initialNotesPanelState, {
      type: 'noteSelected',
      noteId: 'n1',
    })
    expect(selected.mode).toBe('properties')

    const cleared = notesPanelReducer(selected, { type: 'noteSelected', noteId: null })
    expect(cleared.mode).toBe('list')
  })

  it('скрытие меняет только набор скрытых', () => {
    const state = notesPanelReducer(ready(snapshot()), {
      type: 'hiddenChanged',
      hiddenIds: ['n1'],
    })

    expect(selectHiddenIds(state)).toEqual(['n1'])
    expect(selectNotes(state)).toEqual([])
  })

  it('рисование включается и снимается', () => {
    const started = notesPanelReducer(initialNotesPanelState, {
      type: 'drawingStarted',
      kind: 'Circle',
    })
    expect(started.drawingKind).toBe('Circle')
    expect(notesPanelReducer(started, { type: 'drawingStopped' }).drawingKind).toBeNull()
  })

  it('свёрнутость групп переключается одним ключом, включая корень', () => {
    const collapsed = notesPanelReducer(initialNotesPanelState, {
      type: 'groupCollapsedToggled',
      key: '',
    })
    expect(collapsed.collapsedGroupIds).toEqual([''])

    const expanded = notesPanelReducer(collapsed, { type: 'groupCollapsedToggled', key: '' })
    expect(expanded.collapsedGroupIds).toEqual([])
  })

  it('снимок без состояния ничего не ломает', () => {
    const state = notesPanelReducer(initialNotesPanelState, {
      type: 'noteAdded',
      note: sampleNote({ id: 'n1' }),
      geometry: point,
    })

    expect(state.snapshot).toBeNull()
  })
})

describe('редьюсер панели: фильтры', () => {
  it('частичный патч меняет только переданные поля', () => {
    const state = notesPanelReducer(initialNotesPanelState, {
      type: 'filtersChanged',
      filters: { kinds: ['Line'] },
    })

    expect(state.filters.kinds).toEqual(['Line'])
    expect(state.filters.sort).toBe('name')
    expect(state.filters.visibility).toBe('all')
  })

  it('сортировка не считается фильтром', () => {
    const state = notesPanelReducer(initialNotesPanelState, {
      type: 'filtersChanged',
      filters: { sort: 'dateDesc' },
    })

    expect(selectHasNarrowing(state)).toBe(false)
  })

  it('фильтр по виду считается сужением списка', () => {
    const state = notesPanelReducer(initialNotesPanelState, {
      type: 'filtersChanged',
      filters: { kinds: ['Point'] },
    })

    expect(selectHasNarrowing(state)).toBe(true)
  })

  it('загрузка снимка фильтры не сбрасывает', () => {
    const filtered = notesPanelReducer(initialNotesPanelState, {
      type: 'filtersChanged',
      filters: { kinds: ['Line'], sort: 'date' },
    })
    const loaded = notesPanelReducer(filtered, {
      type: 'loaded',
      snapshot: snapshot(),
    })

    expect(loaded.filters).toEqual({
      ...initialNotesPanelState.filters,
      kinds: ['Line'],
      sort: 'date',
    })
  })
})

describe('редьюсер панели: отметки и массовые действия', () => {
  const withNotes = () =>
    ready(
      snapshot({
        manifest: {
          version: 1,
          updatedAt: 'x',
          groups: [sampleGroup()],
          deletedNotes: [],
          notes: [
            sampleNote({ id: 'a', name: 'Первая' }),
            sampleNote({ id: 'b', name: 'Вторая' }),
            sampleNote({ id: 'c', name: 'Третья' }),
          ],
        },
      }),
    )

  it('отметка добавляет и снимает id', () => {
    const marked = notesPanelReducer(initialNotesPanelState, {
      type: 'noteChecked',
      noteId: 'a',
      checked: true,
    })
    expect(marked.checkedIds).toEqual(['a'])

    const cleared = notesPanelReducer(marked, {
      type: 'noteChecked',
      noteId: 'a',
      checked: false,
    })
    expect(cleared.checkedIds).toEqual([])
  })

  it('массовое удаление убирает строки и отметки', () => {
    const marked = notesPanelReducer(withNotes(), {
      type: 'checkedReplaced',
      noteIds: ['a', 'c'],
    })

    const state = notesPanelReducer(marked, { type: 'notesRemoved', noteIds: ['a', 'c'] })

    expect(selectNotes(state).map((note) => note.id)).toEqual(['b'])
    expect(state.checkedIds).toEqual([])
  })

  it('массовое удаление снимает выбор, если выбранная заметка удалена', () => {
    const marked = notesPanelReducer(withNotes(), { type: 'noteSelected', noteId: 'a' })

    const state = notesPanelReducer(marked, { type: 'notesRemoved', noteIds: ['a'] })

    expect(state.selectedId).toBeNull()
    expect(state.mode).toBe('list')
  })

  it('удаление одной заметки убирает её из отметок', () => {
    const marked = notesPanelReducer(withNotes(), {
      type: 'checkedReplaced',
      noteIds: ['a', 'b'],
    })

    const state = notesPanelReducer(marked, { type: 'noteRemoved', noteId: 'a' })

    expect(state.checkedIds).toEqual(['b'])
  })

  it('массовый перенос ставит группу всем отмеченным', () => {
    const state = notesPanelReducer(withNotes(), {
      type: 'notesMoved',
      noteIds: ['a', 'b'],
      groupId: 'group-1',
      updatedAt: '2026-11-17T10:00:00.000Z',
    })

    expect(selectNotes(state).filter((note) => note.groupId === 'group-1')).toHaveLength(2)
    expect(selectNotes(state).find((note) => note.id === 'c')?.groupId).toBeNull()
  })

  it('каскадное удаление группы убирает её заметки из отметок', () => {
    const marked = notesPanelReducer(
      ready(
        snapshot({
          manifest: {
            version: 1,
            updatedAt: 'x',
            groups: [sampleGroup()],
            deletedNotes: [],
            notes: [sampleNote({ id: 'a', groupId: 'group-1' }), sampleNote({ id: 'b' })],
          },
        }),
      ),
      { type: 'checkedReplaced', noteIds: ['a', 'b'] },
    )

    const state = notesPanelReducer(marked, {
      type: 'groupRemoved',
      groupId: 'group-1',
      mode: 'cascade',
    })

    expect(state.checkedIds).toEqual(['b'])
  })
})

describe('селекторы панели', () => {
  const filled = () =>
    ready(
      snapshot({
        manifest: {
          version: 1,
          updatedAt: 'x',
          groups: [sampleGroup()],
          deletedNotes: [],
          notes: [
            sampleNote({ id: 'n2', name: 'Яблоко', description: 'сад' }),
            sampleNote({ id: 'n1', name: 'Арбуз', description: '' }),
            sampleNote({ id: 'n3', name: 'Груша', description: 'поле' }),
          ],
        },
        shards: {
          '2026-11': { version: 1, updatedAt: 'x', notes: { n1: point } },
          '2026-10': {
            version: 1,
            updatedAt: 'x',
            notes: { n2: { kind: 'Point', coords: [38, 56] } },
          },
        },
        hiddenIds: ['n3'],
      }),
    )

  it('сортирует по имени по-русски', () => {
    expect(selectFilteredNotes(filled()).map((note) => note.name)).toEqual([
      'Арбуз',
      'Груша',
      'Яблоко',
    ])
  })

  it('ищет по названию и описанию без учёта регистра', () => {
    const byName = notesPanelReducer(filled(), { type: 'queryChanged', query: 'груш' })
    expect(selectFilteredNotes(byName).map((note) => note.id)).toEqual(['n3'])

    const byDescription = notesPanelReducer(filled(), { type: 'queryChanged', query: 'САД' })
    expect(selectFilteredNotes(byDescription).map((note) => note.id)).toEqual(['n2'])
  })

  it('собирает геометрию из всех шардов', () => {
    const geometries = selectGeometries(filled())

    expect(Object.keys(geometries).sort()).toEqual(['n1', 'n2'])
    expect(selectGeometry(geometries, 'n2')).toEqual({ kind: 'Point', coords: [38, 56] })
    expect(selectGeometry(geometries, 'nope')).toBeNull()
  })

  it('находит выбранную заметку', () => {
    const state = notesPanelReducer(filled(), { type: 'noteSelected', noteId: 'n2' })

    expect(selectSelectedNote(state)?.name).toBe('Яблоко')
    expect(selectSelectedNote(filled())).toBeNull()
  })
})

describe('selectGroups', () => {
  const group = (id: string, name: string, order: number) => ({
    ...sampleGroup({ id, name }),
    order,
  })

  it('отдаёт группы в порядке показа, а не в порядке массива', () => {
    // Манифест складывается из истории создания и слияний между устройствами,
    // поэтому порядок массива произвольный. Список и дропдаун фильтра должны
    // читать один и тот же порядок, иначе выбор «третьей сверху» уйдёт не в ту
    // группу.
    const state = ready(
      snapshot({
        manifest: {
          ...snapshot().manifest,
          groups: [group('c', 'Причалы', 2), group('a', 'Мосты', 0), group('b', 'Дамбы', 1)],
        },
      }),
    )

    expect(selectGroups(state).map((item) => item.name)).toEqual(['Мосты', 'Дамбы', 'Причалы'])
  })

  it('при совпадении order сортирует по имени', () => {
    // `order` может совпасть у групп с разных устройств: обе получили 0.
    const state = ready(
      snapshot({
        manifest: {
          ...snapshot().manifest,
          groups: [group('b', 'Яхты', 0), group('a', 'Ангары', 0)],
        },
      }),
    )

    expect(selectGroups(state).map((item) => item.name)).toEqual(['Ангары', 'Яхты'])
  })
})

describe('фильтр на исчезнувшую группу', () => {
  it('не оставляет пустой список при подписи «Все группы»', () => {
    // Так бывает после удаления группы на другом устройстве: снимок пришёл
    // слиянием, локального действия не было, и фильтр остался на её id.
    // В дропдауне показывалось «Все группы», а список был пуст.
    const state = ready(
      snapshot({
        manifest: {
          ...snapshot().manifest,
          groups: [sampleGroup({ id: 'g1', name: 'Мосты' })],
          notes: [sampleNote({ id: 'n1', groupId: 'g1' })],
        },
      }),
    )

    const filtered = selectFilteredNotes({
      ...state,
      filters: { ...state.filters, group: 'g9' },
    })

    expect(filtered.map((note) => note.id)).toEqual(['n1'])
  })

  it('удаление группы сбрасывает фильтр на неё', () => {
    const groups = [
      sampleGroup({ id: 'g1', name: 'Мосты' }),
      sampleGroup({ id: 'g2', name: 'Дамбы' }),
    ]
    const withGroups = ready(
      snapshot({
        manifest: { ...snapshot().manifest, groups, notes: [sampleNote({ groupId: 'g1' })] },
      }),
    )

    const filtered = { ...withGroups, filters: { ...withGroups.filters, group: 'g1' } }
    const after = notesPanelReducer(filtered, {
      type: 'groupRemoved',
      groupId: 'g1',
      mode: 'keepNotes',
    })

    expect(after.filters.group).toBe('all')
  })

  it('удаление другой группы фильтр не трогает', () => {
    const groups = [
      sampleGroup({ id: 'g1', name: 'Мосты' }),
      sampleGroup({ id: 'g2', name: 'Дамбы' }),
    ]
    const withGroups = ready(snapshot({ manifest: { ...snapshot().manifest, groups, notes: [] } }))

    const filtered = { ...withGroups, filters: { ...withGroups.filters, group: 'g1' } }
    const after = notesPanelReducer(filtered, {
      type: 'groupRemoved',
      groupId: 'g2',
      mode: 'keepNotes',
    })

    expect(after.filters.group).toBe('g1')
  })
})
