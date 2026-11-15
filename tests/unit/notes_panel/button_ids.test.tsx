// @vitest-environment happy-dom

/**
 * id кнопок панели: по ним к кнопкам обращаются извне.
 *
 * В панели свойств id стабильные (`notes_panel_btn_*`). В строке списка таких
 * кнопок столько же, сколько заметок, а id обязан быть уникальным — там
 * добавляется идентификатор заметки, а сам id есть в атрибуте `data-note-id`.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteList } from '@/components/notes_panel/NoteList'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { LocaleProvider } from '@/hooks/useLocale'
import { createDefaultStyle } from '@/lib/notes/style_resolution'
import type { Note } from '@/lib/notes/types'

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
      />,
    )

    expect(document.getElementById('notes_panel_btn_visible')).not.toBeNull()
    expect(document.getElementById('notes_panel_btn_find')).not.toBeNull()
    expect(document.getElementById('notes_panel_btn_delete')).not.toBeNull()
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
      />,
    )

    document.getElementById('notes_panel_btn_find')?.click()
    document.getElementById('notes_panel_btn_visible')?.click()
    document.getElementById('notes_panel_btn_delete')?.click()

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
      />,
    )

    expect(document.getElementById('notes_panel_btn_visible')?.textContent).toBe(
      'Показать на карте',
    )
  })
})

describe('id кнопок в строке списка', () => {
  it('id уникальны для каждой заметки', () => {
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

    expect(document.getElementById('notes_panel_btn_find_note-1')).not.toBeNull()
    expect(document.getElementById('notes_panel_btn_find_note-2')).not.toBeNull()
    expect(document.querySelectorAll('#notes_panel_btn_find')).toHaveLength(0)
  })

  it('кнопки строки несут data-note-id', () => {
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

    const button = document.getElementById('notes_panel_btn_delete_note-1')
    expect(button?.getAttribute('data-note-id')).toBe('note-1')
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

    document.getElementById('notes_panel_btn_delete_note-1')?.click()

    expect(onDelete).toHaveBeenCalledWith('note-1')
  })
})
