// @vitest-environment happy-dom

/**
 * Группы в списке заметок: заголовки, сворачивание и перетаскивание.
 *
 * Перенос заметки — единственное действие, которое меняет состав группы,
 * поэтому проверяется отдельно: он идёт через drag&drop, а не через меню.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteList } from '@/components/notes_panel/NoteList'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { LocaleProvider } from '@/hooks/useLocale'
import { listProps, type NoteListProps, sampleGroup, sampleNote } from './list_props'

const renderList = (props: Partial<NoteListProps>) => {
  const onMoveNote = vi.fn()
  const result = render(
    <LocaleProvider>
      <NoteList {...listProps({ ...props, onMoveNote })} />
    </LocaleProvider>,
  )
  return { ...result, onMoveNote }
}

afterEach(() => {
  cleanup()
})

describe('заголовки групп', () => {
  it('показывает группы и корень', () => {
    renderList({
      notes: [sampleNote({ id: 'a', groupId: 'group-1' }), sampleNote({ id: 'b' })],
      groups: [sampleGroup()],
    })

    expect(screen.getByText('Мосты')).toBeTruthy()
    expect(screen.getByText('Без группы')).toBeTruthy()
  })

  it('считает заметки в каждой группе', () => {
    renderList({
      notes: [
        sampleNote({ id: 'a', groupId: 'group-1' }),
        sampleNote({ id: 'b', groupId: 'group-1' }),
        sampleNote({ id: 'c' }),
      ],
      groups: [sampleGroup()],
    })

    const groupHeader = document.getElementById('nmapUploaderNotesGroup-group-1')
    expect(groupHeader?.textContent).toContain('2')
    const rootHeader = document.getElementById('nmapUploaderNotesGroup-ungrouped')
    expect(rootHeader?.textContent).toContain('1')
  })

  it('сворачивает группу по клику на заголовок', () => {
    const onToggleGroup = vi.fn()
    renderList({ notes: [], groups: [sampleGroup()], onToggleGroup })

    fireEvent.click(
      document.getElementById('nmapUploaderNotesPanelBtnGroupToggle-group-1') as HTMLElement,
    )

    expect(onToggleGroup).toHaveBeenCalledWith('group-1')
  })

  it('свёрнутая группа не показывает свои заметки', () => {
    renderList({
      notes: [sampleNote({ id: 'a', groupId: 'group-1' })],
      groups: [sampleGroup()],
      collapsedGroupIds: ['group-1'],
    })

    expect(screen.queryByText('14.11.2026 Точка')).toBeNull()
  })

  it('у корня нет переименования и удаления', () => {
    renderList({ notes: [sampleNote()], groups: [sampleGroup()] })

    expect(document.getElementById('nmapUploaderNotesGroup-ungrouped')).toBeTruthy()
    expect(document.querySelector('[data-group-id=""] [data-action="rename-group"]')).toBeNull()
    expect(document.querySelector('[data-group-id=""] [data-action="delete-group"]')).toBeNull()
  })

  it('переименовывает группу', () => {
    const onRenameGroup = vi.fn()
    renderList({ notes: [], groups: [sampleGroup()], onRenameGroup })

    fireEvent.click(screen.getByRole('button', { name: 'Переименовать группу' }))
    const input = screen.getByDisplayValue('Мосты')
    fireEvent.change(input, { target: { value: 'Мосты через Волгу' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRenameGroup).toHaveBeenCalledWith('group-1', 'Мосты через Волгу')
  })

  it('не сохраняет пустое имя', () => {
    const onRenameGroup = vi.fn()
    renderList({ notes: [], groups: [sampleGroup()], onRenameGroup })

    fireEvent.click(screen.getByRole('button', { name: 'Переименовать группу' }))
    const input = screen.getByDisplayValue('Мосты')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRenameGroup).not.toHaveBeenCalled()
  })

  it('меняет цвет группы', () => {
    const onRecolorGroup = vi.fn()
    renderList({ notes: [], groups: [sampleGroup()], onRecolorGroup })

    fireEvent.change(screen.getByLabelText('Цвет группы'), {
      target: { value: '#c44fa0' },
    })

    expect(onRecolorGroup).toHaveBeenCalledWith('group-1', '#c44fa0')
  })

  it('просит удалить группу через диалог', () => {
    const onRemoveGroup = vi.fn()
    renderList({ notes: [], groups: [sampleGroup()], onRemoveGroup })

    fireEvent.click(screen.getByRole('button', { name: 'Удалить группу' }))

    expect(onRemoveGroup).toHaveBeenCalledWith('group-1')
  })
})

describe('перетаскивание в группу', () => {
  it('переносит заметку в группу', () => {
    const { onMoveNote } = renderList({
      notes: [sampleNote({ id: 'a' })],
      groups: [sampleGroup()],
    })

    const row = document.getElementById('nmapUploaderNotesRow-a') as HTMLElement
    const header = document.getElementById('nmapUploaderNotesGroup-group-1') as HTMLElement

    fireEvent.dragStart(row)
    fireEvent.dragOver(header)
    fireEvent.drop(header)

    expect(onMoveNote).toHaveBeenCalledWith('a', 'group-1')
  })

  it('возвращает заметку в корень', () => {
    const { onMoveNote } = renderList({
      notes: [sampleNote({ id: 'a', groupId: 'group-1' })],
      groups: [sampleGroup()],
    })

    const row = document.getElementById('nmapUploaderNotesRow-a') as HTMLElement
    const rootHeader = document.getElementById('nmapUploaderNotesGroup-ungrouped') as HTMLElement

    fireEvent.dragStart(row)
    fireEvent.drop(rootHeader)

    expect(onMoveNote).toHaveBeenCalledWith('a', null)
  })

  it('без перетаскивания ничего не переносит', () => {
    const { onMoveNote } = renderList({
      notes: [sampleNote({ id: 'a' })],
      groups: [sampleGroup()],
    })

    const header = document.getElementById('nmapUploaderNotesGroup-group-1') as HTMLElement
    fireEvent.drop(header)

    expect(onMoveNote).not.toHaveBeenCalled()
  })
})

describe('группа в свойствах заметки', () => {
  it('переносит заметку в выбранную группу без перетаскивания', () => {
    const onMoveToGroup = vi.fn()
    render(
      <LocaleProvider>
        <NoteProperties
          note={sampleNote({ groupId: null })}
          fallbackName="14.11.2026 Точка"
          hidden={false}
          onPatch={vi.fn()}
          onDelete={vi.fn()}
          onBack={vi.fn()}
          onLocate={vi.fn()}
          onToggleHidden={vi.fn()}
          groups={[sampleGroup()]}
          onMoveToGroup={onMoveToGroup}
        />
      </LocaleProvider>,
    )

    fireEvent.change(document.getElementById('nmapUploaderNotesPanelSelectGroup') as HTMLElement, {
      target: { value: 'group-1' },
    })

    expect(onMoveToGroup).toHaveBeenCalledWith('group-1')
    cleanup()
  })

  it('возвращает заметку в корень', () => {
    const onMoveToGroup = vi.fn()
    render(
      <LocaleProvider>
        <NoteProperties
          note={sampleNote({ groupId: 'group-1' })}
          fallbackName="14.11.2026 Точка"
          hidden={false}
          onPatch={vi.fn()}
          onDelete={vi.fn()}
          onBack={vi.fn()}
          onLocate={vi.fn()}
          onToggleHidden={vi.fn()}
          groups={[sampleGroup()]}
          onMoveToGroup={onMoveToGroup}
        />
      </LocaleProvider>,
    )

    fireEvent.change(document.getElementById('nmapUploaderNotesPanelSelectGroup') as HTMLElement, {
      target: { value: '' },
    })

    expect(onMoveToGroup).toHaveBeenCalledWith(null)
    cleanup()
  })

  it('без групп селектора нет', () => {
    render(
      <LocaleProvider>
        <NoteProperties
          note={sampleNote()}
          fallbackName="14.11.2026 Точка"
          hidden={false}
          onPatch={vi.fn()}
          onDelete={vi.fn()}
          onBack={vi.fn()}
          onLocate={vi.fn()}
          onToggleHidden={vi.fn()}
          groups={[]}
          onMoveToGroup={vi.fn()}
        />
      </LocaleProvider>,
    )

    expect(document.getElementById('nmapUploaderNotesPanelSelectGroup')).toBeNull()
    cleanup()
  })
})
