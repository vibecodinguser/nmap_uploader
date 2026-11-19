// @vitest-environment happy-dom

/**
 * Удаление спрашивает подтверждение — и для одной заметки, и для пачки.
 *
 * Наборы на уровне компонентов этого не ловят: диалог есть, но подключён
 * может быть только к одному пути. Здесь проверяется именно проводка в
 * приложении панели, поэтому хук подменён целиком, а нажатия — настоящие.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesPanelApp } from '@/entrypoints/notes-panel/App'
import { LocaleProvider } from '@/hooks/useLocale'
import { createDefaultStyle } from '@/lib/notes/model/style_resolution'
import type { Note } from '@/lib/notes/model/types'

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Point',
  name: 'Мост через Каму',
  description: '',
  date: '16-11-2026',
  icon: null,
  showLabel: false,
  style: createDefaultStyle('Point'),
  groupId: null,
  createdAt: '2026-11-16T10:00:00.000Z',
  updatedAt: '2026-11-16T10:00:00.000Z',
  ...overrides,
})

const removeNote = vi.fn()
const deleteChecked = vi.fn()

const panelState = {
  status: 'ready' as const,
  mode: 'list' as const,
  error: null,
  undo: null,
  query: '',
  setQuery: vi.fn(),
  drawingKind: null,
  createGroup: vi.fn(),
  startDrawing: vi.fn(),
  filters: {},
  setFilters: vi.fn(),
  resetFilters: vi.fn(),
  groups: [],
  notes: [note(), note({ id: 'note-2', name: 'Дамба' })],
  checkedIds: ['note-1', 'note-2'],
  selectedNote: null,
  selectedId: null,
  hiddenIds: [],
  checkAllVisible: vi.fn(),
  clearChecked: vi.fn(),
  deleteChecked,
  moveCheckedToGroup: vi.fn(),
  updateNote: vi.fn(),
  removeNote,
  selectNote: vi.fn(),
  locateNote: vi.fn(),
  toggleHidden: vi.fn(),
  moveNoteToGroup: vi.fn(),
  removeGroup: vi.fn(),
  toggleGroupCollapsed: vi.fn(),
  renameGroup: vi.fn(),
  recolorGroup: vi.fn(),
  toggleGroupHidden: vi.fn(),
  undoRemove: vi.fn(),
  loadNotes: vi.fn(),
  login: vi.fn(),
  t: (key: string) => key,
}

vi.mock('@/hooks/useNotesPanel', () => ({
  useNotesPanel: () => panelState,
}))

const renderApp = () =>
  render(
    <LocaleProvider>
      <NotesPanelApp />
    </LocaleProvider>,
  )

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  removeNote.mockClear()
  deleteChecked.mockClear()
})

describe('подтверждение удаления в приложении панели', () => {
  it('пачка: спрашивает подтверждение, а не удаляет сразу', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Удалить отмеченные' }))

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    // До подтверждения ничего не удалено — иначе диалог был бы бесполезен.
    expect(deleteChecked).not.toHaveBeenCalled()
  })

  it('пачка: удаляет после подтверждения', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Удалить отмеченные' }))
    // Кнопка в диалоге, а не иконка удаления в строке: у них одинаковое имя.
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }))

    expect(deleteChecked).toHaveBeenCalledOnce()
    expect(removeNote).not.toHaveBeenCalled()
  })

  it('пачка: отмена оставляет заметки', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Удалить отмеченные' }))
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))

    expect(deleteChecked).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('одна заметка: тоже спрашивает подтверждение', () => {
    renderApp()

    // Иконка удаления в строке списка.
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0])

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(removeNote).not.toHaveBeenCalled()
  })

  it('одна заметка: удаляет после подтверждения', () => {
    renderApp()

    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0])
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }))

    expect(removeNote).toHaveBeenCalledWith('note-1')
    expect(deleteChecked).not.toHaveBeenCalled()
  })

  it('оба пути используют один и тот же диалог', () => {
    // Требование простое: разница только в тексте вопроса, сама форма та же.
    renderApp()

    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0])
    const single = screen.getByRole('alertdialog')
    const singleButtons = [...single.querySelectorAll('button')].map((b) => b.textContent)
    fireEvent.click(within(single).getByRole('button', { name: 'Отменить' }))

    fireEvent.click(screen.getByRole('button', { name: 'Удалить отмеченные' }))
    const bulk = screen.getByRole('alertdialog')
    const bulkButtons = [...bulk.querySelectorAll('button')].map((b) => b.textContent)

    expect(bulk.className).toBe(single.className)
    expect(bulkButtons).toEqual(singleButtons)
  })

  it('в вопросе о пачке стоит количество, а не имя заметки', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Удалить отмеченные' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Удалить отмеченные заметки: 2?')
    // Про одну заметку в вопросе речи нет — иначе это был бы другой путь.
    expect(dialog.textContent).not.toContain('Удалить заметку «')
  })
})
