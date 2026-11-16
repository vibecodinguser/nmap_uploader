// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteList as NoteListBase } from '@/components/notes_panel/NoteList'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { ShapePicker } from '@/components/notes_panel/ShapePicker'
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

describe('NoteProperties', () => {
  it('передаёт правку названия наверх', () => {
    const onPatch = vi.fn()
    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        hidden={false}
        onPatch={onPatch}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        onLocate={vi.fn()}
        onToggleHidden={vi.fn()}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Название'), { target: { value: 'Мост' } })

    expect(onPatch).toHaveBeenCalledWith({ name: 'Мост' })
  })

  it('не отправляет невалидную дату', () => {
    const onPatch = vi.fn()
    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        hidden={false}
        onPatch={onPatch}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        onLocate={vi.fn()}
        onToggleHidden={vi.fn()}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    const dateInput = screen.getByPlaceholderText('дд.мм.гггг')
    fireEvent.change(dateInput, { target: { value: '32-13-2026' } })
    fireEvent.blur(dateInput)

    expect(onPatch).not.toHaveBeenCalled()
    expect(screen.getByText('Дата в формате дд.мм.гггг')).toBeTruthy()
  })

  it('сохраняет валидную дату', () => {
    const onPatch = vi.fn()
    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        hidden={false}
        onPatch={onPatch}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        onLocate={vi.fn()}
        onToggleHidden={vi.fn()}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    const dateInput = screen.getByPlaceholderText('дд.мм.гггг')
    fireEvent.change(dateInput, { target: { value: '01-12-2026' } })
    fireEvent.blur(dateInput)

    expect(onPatch).toHaveBeenCalledWith({ date: '01-12-2026' })
  })

  it('переключает подпись и прозрачность', () => {
    const onPatch = vi.fn()
    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        hidden={false}
        onPatch={onPatch}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        onLocate={vi.fn()}
        onToggleHidden={vi.fn()}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox'))

    expect(onPatch).toHaveBeenCalledWith({ showLabel: true })
  })

  it('вызывает удаление', () => {
    const onDelete = vi.fn()
    wrap(
      <NoteProperties
        note={note()}
        fallbackName="14.11.2026 Точка"
        hidden={false}
        onPatch={vi.fn()}
        onDelete={onDelete}
        onBack={vi.fn()}
        onLocate={vi.fn()}
        onToggleHidden={vi.fn()}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    expect(onDelete).toHaveBeenCalledOnce()
  })
})

describe('NoteList', () => {
  it('выбирает заметку по клику на строку', () => {
    const onSelect = vi.fn()
    wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={onSelect}
        onToggleHidden={vi.fn()}
        onLocate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('14.11.2026 Точка'))

    expect(onSelect).toHaveBeenCalledWith('note-1')
  })

  it('показывает состояние видимости и переключает его', () => {
    const onToggleHidden = vi.fn()
    wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={['note-1']}
        selectedId={null}
        onSelect={vi.fn()}
        onToggleHidden={onToggleHidden}
        onLocate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: 'Показать на карте' })
    expect(button.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(button)
    expect(onToggleHidden).toHaveBeenCalledWith('note-1')
  })

  it('показывает глаз для видимости и перечёркнутый глаз для скрытой', () => {
    const { container, rerender } = wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onToggleHidden={vi.fn()}
        onLocate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(container.querySelector('.notes-panel__row-action .nk-icon svg')).not.toBeNull()

    rerender(
      <LocaleProvider>
        <NoteList
          notes={[note()]}
          hiddenIds={['note-1']}
          selectedId={null}
          onSelect={vi.fn()}
          onToggleHidden={vi.fn()}
          onLocate={vi.fn()}
          onDelete={vi.fn()}
        />
      </LocaleProvider>,
    )

    const hiddenIcon = container.querySelector('.notes-panel__row-action .nk-icon')
    expect(hiddenIcon?.getAttribute('class')).not.toContain('nk-icon_id_center')
  })

  it('иконка «Найти на карте» несёт нативные классы редактора', () => {
    const { container } = wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onToggleHidden={vi.fn()}
        onLocate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const locate = container.querySelector('.nk-icon_id_center')
    expect(locate?.getAttribute('class')).toContain('nk-tracker-settings-view__pos-by-bounds')
  })

  it('удаляет заметку по кнопке в строке', () => {
    const onDelete = vi.fn()
    wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onToggleHidden={vi.fn()}
        onLocate={vi.fn()}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    expect(onDelete).toHaveBeenCalledWith('note-1')
  })

  it('иконка удаления несёт нативные классы редактора', () => {
    const { container } = wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onToggleHidden={vi.fn()}
        onLocate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const remove = container.querySelector('.nk-icon_id_delete-small')
    expect(remove?.getAttribute('class')).toContain('nk-tracker-settings-view__delete')
  })

  it('центрирует карту по кнопке', () => {
    const onLocate = vi.fn()
    wrap(
      <NoteList
        notes={[note()]}
        hiddenIds={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onToggleHidden={vi.fn()}
        onLocate={onLocate}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Найти на карте' }))

    expect(onLocate).toHaveBeenCalledWith('note-1')
  })
})

describe('ShapePicker', () => {
  it('предлагает все пять видов фигуры', () => {
    wrap(<ShapePicker onPick={vi.fn()} onCancel={vi.fn()} busy={false} />)

    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(labels).toEqual(['Точка', 'Линия', 'Многоугольник', 'Квадрат', 'Круг'])
  })

  it('передаёт выбранный вид', () => {
    const onPick = vi.fn()
    wrap(<ShapePicker onPick={onPick} onCancel={vi.fn()} busy={false} />)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Круг' }))

    expect(onPick).toHaveBeenCalledWith('Circle')
  })

  it('блокирует выбор, пока идёт рисование', () => {
    wrap(<ShapePicker onPick={vi.fn()} onCancel={vi.fn()} busy />)

    for (const item of screen.getAllByRole('menuitem')) {
      expect((item as HTMLButtonElement).disabled).toBe(true)
    }
  })
})
