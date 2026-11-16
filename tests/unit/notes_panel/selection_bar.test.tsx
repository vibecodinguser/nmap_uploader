// @vitest-environment happy-dom

/**
 * Панель массовых действий и отметки в строках.
 *
 * Панель появляется только при отметках: постоянно висящая полоса с
 * неактивными кнопками отнимает место у списка в четверти экрана.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteList as NoteListBase, noteRowIds } from '@/components/notes_panel/NoteList'
import { SelectionBar } from '@/components/notes_panel/SelectionBar'
import { LocaleProvider } from '@/hooks/useLocale'
import {
  listProps,
  type NoteListProps,
  sampleGroup,
  sampleNote,
} from '@/tests/unit/notes_panel/list_props'

const NoteList = (props: Partial<NoteListProps>) => <NoteListBase {...listProps(props)} />

const wrap = (ui: React.ReactElement) => render(<LocaleProvider>{ui}</LocaleProvider>)

afterEach(() => {
  cleanup()
})

describe('отметка в строке', () => {
  it('чекбокс есть у каждой заметки и адресуем', () => {
    wrap(
      <NoteList
        notes={[sampleNote({ id: 'note-1' }), sampleNote({ id: 'note-2', name: 'Вторая' })]}
      />,
    )

    expect(document.getElementById(noteRowIds('note-1').check)).not.toBeNull()
    expect(document.getElementById(noteRowIds('note-2').check)).not.toBeNull()
  })

  it('отметка уходит наверх с id и состоянием', () => {
    const onCheck = vi.fn()
    wrap(<NoteList notes={[sampleNote({ id: 'note-1' })]} onCheck={onCheck} />)

    fireEvent.click(document.getElementById(noteRowIds('note-1').check) as HTMLElement)

    expect(onCheck).toHaveBeenCalledWith('note-1', true)
  })

  it('отмеченная заметка показывает чекбокс включённым', () => {
    wrap(<NoteList notes={[sampleNote({ id: 'note-1' })]} checkedIds={['note-1']} />)

    const check = document.getElementById(noteRowIds('note-1').check) as HTMLInputElement
    expect(check.checked).toBe(true)
  })

  it('отметка не мешает клику по строке', () => {
    const onSelect = vi.fn()
    wrap(<NoteList notes={[sampleNote({ id: 'note-1' })]} onSelect={onSelect} />)

    fireEvent.click(document.getElementById(noteRowIds('note-1').main) as HTMLElement)

    expect(onSelect).toHaveBeenCalledWith('note-1')
  })
})

describe('панель массовых действий', () => {
  const base = {
    groups: [sampleGroup()],
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    onDelete: vi.fn(),
    onMoveToGroup: vi.fn(),
  }

  it('без отметок панели нет', () => {
    const { container } = wrap(<SelectionBar count={0} {...base} />)

    expect(container.querySelector('.notes-panel__selection')).toBeNull()
  })

  it('показывает число отмеченных', () => {
    wrap(<SelectionBar count={3} {...base} />)

    expect(screen.getByText('Отмечено: 3')).toBeTruthy()
  })

  it('удаление вызывает обработчик', () => {
    const onDelete = vi.fn()
    wrap(<SelectionBar count={2} {...base} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Удалить отмеченные' }))

    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('перенос в корень передаёт null', () => {
    const onMoveToGroup = vi.fn()
    wrap(<SelectionBar count={1} {...base} onMoveToGroup={onMoveToGroup} />)

    fireEvent.change(screen.getByLabelText('Перенести в группу'), {
      target: { value: '__none__' },
    })

    expect(onMoveToGroup).toHaveBeenCalledWith(null)
  })

  it('перенос в группу передаёт её id', () => {
    const onMoveToGroup = vi.fn()
    wrap(<SelectionBar count={1} {...base} onMoveToGroup={onMoveToGroup} />)

    fireEvent.change(screen.getByLabelText('Перенести в группу'), {
      target: { value: 'group-1' },
    })

    expect(onMoveToGroup).toHaveBeenCalledWith('group-1')
  })

  it('без групп селекта переноса нет', () => {
    wrap(<SelectionBar count={1} {...base} groups={[]} />)

    expect(screen.queryByLabelText('Перенести в группу')).toBeNull()
  })

  it('снятие отметок и «отметить все» доступны', () => {
    const onClear = vi.fn()
    const onSelectAll = vi.fn()
    wrap(<SelectionBar count={2} {...base} onClear={onClear} onSelectAll={onSelectAll} />)

    fireEvent.click(screen.getByRole('button', { name: 'Снять отметки' }))
    fireEvent.click(screen.getByRole('button', { name: 'Отметить все' }))

    expect(onClear).toHaveBeenCalledOnce()
    expect(onSelectAll).toHaveBeenCalledOnce()
  })
})
