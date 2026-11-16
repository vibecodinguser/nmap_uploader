// @vitest-environment happy-dom

/**
 * Клавиатурная навигация по списку.
 *
 * Список виртуализирован, поэтому «курсор» — это id заметки в данных, а не
 * DOM-фокус: часть строк отсутствует в документе.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteList } from '@/components/notes_panel/NoteList'
import { noteRowIds } from '@/components/notes_panel/NoteRow'
import { LocaleProvider } from '@/hooks/useLocale'
import { listProps, sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

const threeNotes = () => [
  sampleNote({ id: 'note-1', name: 'Первая' }),
  sampleNote({ id: 'note-2', name: 'Вторая' }),
  sampleNote({ id: 'note-3', name: 'Третья' }),
]

const renderList = (props: Parameters<typeof listProps>[0] = {}) =>
  render(
    <LocaleProvider>
      <NoteList {...listProps(props)} />
    </LocaleProvider>,
  )

const list = (): HTMLElement => screen.getByLabelText('Список заметок')

afterEach(() => {
  cleanup()
})

describe('стрелки', () => {
  it('вниз ставит курсор на первую заметку, затем двигает дальше', () => {
    renderList({ notes: threeNotes() })

    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    expect(document.getElementById(noteRowIds('note-1').row)?.dataset.active).toBe('true')

    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    expect(document.getElementById(noteRowIds('note-2').row)?.dataset.active).toBe('true')
  })

  it('вверх возвращает курсор назад', () => {
    renderList({ notes: threeNotes() })

    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    fireEvent.keyDown(list(), { key: 'ArrowUp' })

    expect(document.getElementById(noteRowIds('note-1').row)?.dataset.active).toBe('true')
  })

  it('за границей списка курсор не уезжает', () => {
    renderList({ notes: threeNotes() })

    fireEvent.keyDown(list(), { key: 'ArrowUp' })
    expect(document.getElementById(noteRowIds('note-1').row)?.dataset.active).toBe('true')

    for (let index = 0; index < 10; index += 1) {
      fireEvent.keyDown(list(), { key: 'ArrowDown' })
    }
    expect(document.getElementById(noteRowIds('note-3').row)?.dataset.active).toBe('true')
  })

  it('Home и End прыгают к краям', () => {
    renderList({ notes: threeNotes() })

    fireEvent.keyDown(list(), { key: 'End' })
    expect(document.getElementById(noteRowIds('note-3').row)?.dataset.active).toBe('true')

    fireEvent.keyDown(list(), { key: 'Home' })
    expect(document.getElementById(noteRowIds('note-1').row)?.dataset.active).toBe('true')
  })

  it('заголовки групп курсор пропускает', () => {
    renderList({
      notes: [sampleNote({ id: 'note-1', groupId: 'group-1' }), sampleNote({ id: 'note-2' })],
      groups: [sampleGroup()],
    })

    // Первая заметка в DOM идёт после заголовка группы: стрелка вниз должна
    // попасть именно на неё, а не «в заголовок».
    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    expect(document.getElementById(noteRowIds('note-1').row)?.dataset.active).toBe('true')
  })
})

describe('действия', () => {
  it('Enter открывает свойства', () => {
    const onSelect = vi.fn()
    renderList({ notes: threeNotes(), onSelect })

    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    fireEvent.keyDown(list(), { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith('note-1')
  })

  it('пробел отмечает заметку и снимает отметку', () => {
    const onCheck = vi.fn()
    const notes = threeNotes()
    renderList({ notes, onCheck })

    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    fireEvent.keyDown(list(), { key: ' ' })
    expect(onCheck).toHaveBeenCalledWith('note-1', true)

    cleanup()
    render(
      <LocaleProvider>
        <NoteList {...listProps({ notes, onCheck, checkedIds: ['note-1'] })} />
      </LocaleProvider>,
    )
    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    fireEvent.keyDown(list(), { key: ' ' })
    expect(onCheck).toHaveBeenLastCalledWith('note-1', false)
  })

  it('без курсора Enter и пробел ничего не делают', () => {
    const onSelect = vi.fn()
    const onCheck = vi.fn()
    renderList({ notes: threeNotes(), onSelect, onCheck })

    fireEvent.keyDown(list(), { key: 'Enter' })
    fireEvent.keyDown(list(), { key: ' ' })

    expect(onSelect).not.toHaveBeenCalled()
    expect(onCheck).not.toHaveBeenCalled()
  })
})

describe('поля ввода', () => {
  it('стрелки внутри поля не двигают список', () => {
    renderList({ notes: threeNotes() })

    fireEvent.keyDown(list(), { key: 'ArrowDown' })

    const input = document.createElement('input')
    list().appendChild(input)
    fireEvent.keyDown(input, { key: 'ArrowDown', bubbles: true })

    // Курсор остался на первой заметке: событие пришло из поля.
    expect(document.getElementById(noteRowIds('note-1').row)?.dataset.active).toBe('true')
  })
})

describe('выбор мышью', () => {
  it('ставит курсор на выбранную заметку', () => {
    const notes = threeNotes()
    renderList({ notes, selectedId: 'note-3' })

    // После выбора мышью стрелка вниз идёт от выбранной заметки, а не с начала.
    fireEvent.keyDown(list(), { key: 'ArrowUp' })

    expect(document.getElementById(noteRowIds('note-2').row)?.dataset.active).toBe('true')
  })
})
