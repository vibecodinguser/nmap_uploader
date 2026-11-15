// @vitest-environment happy-dom

/**
 * id кнопок панели: по ним к кнопкам обращаются извне.
 *
 * Стиль повторяет остальные id расширения (`nmapUploaderNotesButton`):
 * camelCase с префиксом `nmapUploader`. В свойствах кнопка одна, в строке
 * списка кнопок столько же, сколько заметок, поэтому к id добавляется
 * идентификатор заметки, а сам он есть в атрибуте `data-note-id`.
 */
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteList as NoteListBase, noteRowIds } from '@/components/notes_panel/NoteList'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { LocaleProvider } from '@/hooks/useLocale'
import { createDefaultStyle } from '@/lib/notes/style_resolution'
import type { Note } from '@/lib/notes/types'
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

describe('id кнопок в свойствах заметки', () => {
  it('использует стабильные id', () => {
    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        hidden={false}
        onPatch={noop}
        onDelete={noop}
        onBack={noop}
        onLocate={noop}
        onToggleHidden={noop}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    expect(document.getElementById('nmapUploaderNotesPanelBtnVisible')).not.toBeNull()
    expect(document.getElementById('nmapUploaderNotesPanelBtnFind')).not.toBeNull()
    expect(document.getElementById('nmapUploaderNotesPanelBtnDelete')).not.toBeNull()
  })

  it('id ведут на нужные действия', () => {
    const onLocate = vi.fn()
    const onDelete = vi.fn()
    const onToggleHidden = vi.fn()

    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        hidden={false}
        onPatch={noop}
        onDelete={onDelete}
        onBack={noop}
        onLocate={onLocate}
        onToggleHidden={onToggleHidden}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    document.getElementById('nmapUploaderNotesPanelBtnFind')?.click()
    document.getElementById('nmapUploaderNotesPanelBtnVisible')?.click()
    document.getElementById('nmapUploaderNotesPanelBtnDelete')?.click()

    expect(onLocate).toHaveBeenCalledOnce()
    expect(onToggleHidden).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('подпись кнопки видимости соответствует состоянию', () => {
    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        hidden
        onPatch={noop}
        onDelete={noop}
        onBack={noop}
        onLocate={noop}
        onToggleHidden={noop}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    expect(document.getElementById('nmapUploaderNotesPanelBtnVisible')?.textContent).toBe(
      'Показать на карте',
    )
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

    expect(document.getElementById(noteRowIds('note-1').visibility)).not.toBeNull()
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
    expect(document.getElementById(noteRowIds('note-1').row)?.getAttribute('data-note-id')).toBe(
      'note-1',
    )
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
