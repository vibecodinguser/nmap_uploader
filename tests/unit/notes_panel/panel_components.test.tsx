// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

afterEach(() => {
  cleanup()
})

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
      />,
    )

    const button = screen.getByRole('button', { name: 'Показать на карте' })
    expect(button.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(button)
    expect(onToggleHidden).toHaveBeenCalledWith('note-1')
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
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Найти на карте' }))

    expect(onLocate).toHaveBeenCalledWith('note-1')
  })
})
