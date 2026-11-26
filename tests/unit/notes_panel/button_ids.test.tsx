// @vitest-environment happy-dom

/**
 * id кнопок панели: по ним к кнопкам обращаются извне.
 *
 * Стиль повторяет остальные id расширения (`nmapUploaderNotesButton`):
 * camelCase с префиксом `nmapUploader`. В свойствах кнопка одна, в строке
 * списка кнопок столько же, сколько заметок, поэтому к id добавляется
 * идентификатор заметки, а сам он есть в атрибуте `data-note-id`.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteList as NoteListBase, noteRowIds } from '@/components/notes_panel/NoteList'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { LocaleProvider } from '@/hooks/useLocale'
import { createDefaultStyle } from '@/lib/notes/model/style_resolution'
import type { Note } from '@/lib/notes/model/types'
import { listProps, type NoteListProps } from './list_props'

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Point',
  name: '14.11.2026 Точка',
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

const wrap = (ui: React.ReactElement) => render(<LocaleProvider>{ui}</LocaleProvider>)

const noop = vi.fn()

afterEach(() => {
  cleanup()
})

/**
 * Обёртка со значениями группировки по умолчанию.
 *
 * Почти все проверки списка — про строку заметки и её действия; группы нужны
 * только в отдельных тестах, и там они передаются явно.
 */
const NoteList = (props: Partial<NoteListProps>) => <NoteListBase {...listProps(props)} />

describe('кнопки действий', () => {
  it('в карточке заметки их нет: действия живут в строке списка', () => {
    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        onPatch={noop}
        onBack={noop}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    // «Найти», «Скрыть» и «Удалить» продублированы кнопками каждой строки,
    // поэтому из карточки убраны — дублировали друг друга и занимали место.
    expect(document.getElementById('nmapUploaderNotesPanelBtnVisible')).toBeNull()
    expect(document.getElementById('nmapUploaderNotesPanelBtnFind')).toBeNull()
    expect(document.getElementById('nmapUploaderNotesPanelBtnDelete')).toBeNull()
  })
})

describe('id кнопок в строке списка', () => {
  it('строятся по схеме noteRowIds и уникальны для каждой заметки', () => {
    wrap(
      <NoteList
        notes={[note({ id: 'note-1' }), note({ id: 'note-2', name: 'Вторая' })]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={noop}
        onToggleHidden={noop}
        onLocate={noop}
        onDelete={noop}
      />,
    )

    // Все элементы строки адресуемы: строка, кнопка выбора и три действия.
    for (const id of Object.values(noteRowIds('note-1'))) {
      expect(document.getElementById(id)).not.toBeNull()
    }
    expect(document.getElementById(noteRowIds('note-2').visibility)).not.toBeNull()
    expect(noteRowIds('note-1').delete).not.toBe(noteRowIds('note-2').delete)
  })

  it('кнопки строки несут data-action, строка — data-note-id', () => {
    wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={noop}
        onToggleHidden={noop}
        onLocate={noop}
        onDelete={noop}
      />,
    )

    expect(document.getElementById(noteRowIds('note-1').delete)?.getAttribute('data-action')).toBe(
      'delete',
    )
    const row = document.getElementById(noteRowIds('note-1').row)
    expect(row?.getAttribute('data-note-id')).toBe('note-1')
    expect(row?.getAttribute('data-note-kind')).toBe('Point')
  })

  it('id строки ведёт на нужное действие', () => {
    const onDelete = vi.fn()

    wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={noop}
        onToggleHidden={noop}
        onLocate={noop}
        onDelete={onDelete}
      />,
    )

    document.getElementById(noteRowIds('note-1').delete)?.click()

    expect(onDelete).toHaveBeenCalledWith('note-1')
  })
})
