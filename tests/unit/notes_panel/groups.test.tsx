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

describe('видимость группы', () => {
  const twoInGroup = [
    sampleNote({ id: 'a', groupId: 'group-1' }),
    sampleNote({ id: 'b', groupId: 'group-1' }),
    sampleNote({ id: 'c' }),
  ]

  it('скрывает все объекты группы одним нажатием', () => {
    const onToggleGroupVisibility = vi.fn()
    render(
      <LocaleProvider>
        <NoteList
          {...listProps({
            notes: twoInGroup,
            groups: [sampleGroup()],
            onToggleGroupVisibility,
          })}
        />
      </LocaleProvider>,
    )

    fireEvent.click(
      document.getElementById('nmapUploaderNotesPanelBtnGroupVisible-group-1') as HTMLElement,
    )

    expect(onToggleGroupVisibility).toHaveBeenCalledWith(['a', 'b'], 'visible')
  })

  it('показывает группу, если она скрыта', () => {
    const onToggleGroupVisibility = vi.fn()
    render(
      <LocaleProvider>
        <NoteList
          {...listProps({
            notes: twoInGroup,
            groups: [sampleGroup()],
            hiddenIds: ['a', 'b'],
            onToggleGroupVisibility,
          })}
        />
      </LocaleProvider>,
    )

    fireEvent.click(
      document.getElementById('nmapUploaderNotesPanelBtnGroupVisible-group-1') as HTMLElement,
    )

    expect(onToggleGroupVisibility).toHaveBeenCalledWith(['a', 'b'], 'hidden')
  })

  it('частично скрытая группа показывает приглушённый глаз', () => {
    render(
      <LocaleProvider>
        <NoteList
          {...listProps({
            notes: twoInGroup,
            groups: [sampleGroup()],
            hiddenIds: ['a'],
          })}
        />
      </LocaleProvider>,
    )

    const button = document.getElementById(
      'nmapUploaderNotesPanelBtnGroupVisible-group-1',
    ) as HTMLElement
    expect(button.dataset.visibility).toBe('mixed')
    expect(button.querySelector('.nk-icon')?.getAttribute('data-mixed')).toBe('true')
  })

  it('у корня тоже есть переключатель видимости', () => {
    render(
      <LocaleProvider>
        <NoteList {...listProps({ notes: twoInGroup, groups: [sampleGroup()] })} />
      </LocaleProvider>,
    )

    expect(document.getElementById('nmapUploaderNotesPanelBtnGroupVisible-ungrouped')).toBeTruthy()
  })

  it('кнопка группы скрывает весь набор, даже если часть уже скрыта', () => {
    // Правило «выбрать всё»: при частично скрытой группе скрываем остаток.
    const onToggle = vi.fn()
    render(
      <LocaleProvider>
        <NoteList
          {...listProps({
            notes: twoInGroup,
            groups: [sampleGroup()],
            hiddenIds: ['a'],
            onToggleGroupVisibility: onToggle,
          })}
        />
      </LocaleProvider>,
    )

    fireEvent.click(
      document.getElementById('nmapUploaderNotesPanelBtnGroupVisible-group-1') as HTMLElement,
    )

    expect(onToggle).toHaveBeenCalledWith(['a', 'b'], 'mixed')
  })
})

describe('хук: видимость группы', () => {
  it('скрывает всю группу и отправляет один набор скрытых', async () => {
    const { useNotesPanel } = await import('@/hooks/useNotesPanel')
    const { renderHook, waitFor, act } = await import('@testing-library/react')
    const { browser } = await import('wxt/browser')
    const { resetBrowserMocks } = await import('@/tests/setup/browser_mock')
    await resetBrowserMocks()

    const notes = [
      sampleNote({ id: 'a', groupId: 'group-1' }),
      sampleNote({ id: 'b', groupId: 'group-1' }),
    ]
    const snapshot = {
      manifest: {
        version: 1,
        updatedAt: '2026-11-14T10:00:00.000Z',
        groups: [sampleGroup()],
        notes,
      },
      shards: {},
      hiddenIds: [],
      fromCache: false,
    }

    const sendMessage = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({
      ok: true,
      snapshot,
    } as never)

    const { result } = renderHook(() => useNotesPanel(), {
      wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.toggleGroupHidden(['a', 'b'], 'visible')
    })

    expect(result.current.hiddenIds.sort()).toEqual(['a', 'b'])
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTES_HIDDEN_CHANGED', hiddenIds: ['a', 'b'] }),
    )

    act(() => {
      result.current.toggleGroupHidden(['a', 'b'], 'hidden')
    })

    expect(result.current.hiddenIds).toEqual([])
    cleanup()
  })
})

describe('всплытие события drop', () => {
  it('бросок на заголовок группы не переносит заметку ещё и в корень', () => {
    const onMoveNote = vi.fn()
    render(
      <LocaleProvider>
        <NoteList
          {...listProps({
            notes: [sampleNote({ id: 'a' })],
            groups: [sampleGroup()],
            onMoveNote,
          })}
        />
      </LocaleProvider>,
    )

    const row = document.getElementById('nmapUploaderNotesRow-a') as HTMLElement
    const header = document.getElementById('nmapUploaderNotesGroup-group-1') as HTMLElement

    fireEvent.dragStart(row)
    fireEvent.drop(header)

    // Ровно один перенос — в группу. Второй вызов (в корень) означал бы, что
    // событие всплыло до контейнера списка.
    expect(onMoveNote).toHaveBeenCalledTimes(1)
    expect(onMoveNote).toHaveBeenCalledWith('a', 'group-1')
    cleanup()
  })

  it('бросок на строку заметки не уводит её в корень', () => {
    const onMoveNote = vi.fn()
    render(
      <LocaleProvider>
        <NoteList
          {...listProps({
            notes: [sampleNote({ id: 'a', groupId: 'group-1' }), sampleNote({ id: 'b' })],
            groups: [sampleGroup()],
            onMoveNote,
          })}
        />
      </LocaleProvider>,
    )

    const rowA = document.getElementById('nmapUploaderNotesRow-a') as HTMLElement
    const rowB = document.getElementById('nmapUploaderNotesRow-b') as HTMLElement

    fireEvent.dragStart(rowA)
    fireEvent.drop(rowB)

    expect(onMoveNote).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('бросок мимо строк переносит заметку в корень', () => {
    const onMoveNote = vi.fn()
    render(
      <LocaleProvider>
        <NoteList
          {...listProps({
            notes: [sampleNote({ id: 'a', groupId: 'group-1' })],
            groups: [sampleGroup()],
            onMoveNote,
          })}
        />
      </LocaleProvider>,
    )

    const row = document.getElementById('nmapUploaderNotesRow-a') as HTMLElement
    const list = document.querySelector('.notes-panel__list') as HTMLElement

    fireEvent.dragStart(row)
    fireEvent.drop(list)

    expect(onMoveNote).toHaveBeenCalledWith('a', null)
    cleanup()
  })
})
