// @vitest-environment happy-dom

/**
 * Строка инструментов списка и шапка панели.
 *
 * Создание живёт в строке инструментов, а не в шапке рядом с кнопками окна.
 * Выбор — режим: при отметке панель выбора встаёт на место создания и
 * фильтров, а не добавляется второй полосой под ними.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateActions } from '@/components/notes_panel/CreateActions'
import { NOTES_PANEL_BUTTON_IDS } from '@/components/notes_panel/ids'
import { ListToolbar } from '@/components/notes_panel/ListToolbar'
import { PanelHeader } from '@/components/notes_panel/PanelHeader'
import { LocaleProvider } from '@/hooks/useLocale'
import { DEFAULT_NOTES_FILTER } from '@/lib/notes/panel/filters'

const wrap = (ui: ReactElement) => render(<LocaleProvider>{ui}</LocaleProvider>)

const toolbarProps = (
  count: number,
  create: Partial<ComponentProps<typeof CreateActions>> = {},
  hasNotes = true,
): ComponentProps<typeof ListToolbar> => ({
  hasNotes,
  create: { drawing: false, onCreateGroup: vi.fn(), onStartDrawing: vi.fn(), ...create },
  filters: { filter: DEFAULT_NOTES_FILTER, groups: [], onChange: vi.fn(), onReset: vi.fn() },
  selection: {
    count,
    groups: [],
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    onDelete: vi.fn(),
    onMoveToGroup: vi.fn(),
  },
})

afterEach(() => {
  cleanup()
})

describe('ListToolbar', () => {
  it('без отметок показывает создание и фильтры', () => {
    wrap(<ListToolbar {...toolbarProps(0)} />)

    expect(screen.getByRole('button', { name: /Заметка/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Группа/ })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Фильтр по виду' })).toBeTruthy()
    expect(document.querySelector('.notes-panel__selection')).toBeNull()
  })

  it('без отметок даёт войти в режим выбора кнопкой «Отметить все»', () => {
    // Раньше кнопка жила только в панели выбора, а та появляется при первой
    // отметке: отметить всё разом было нечем.
    const props = toolbarProps(0)
    wrap(<ListToolbar {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Отметить все' }))

    expect(props.selection.onSelectAll).toHaveBeenCalledOnce()
  })

  it('при пустом списке кнопки «Отметить все» нет', () => {
    wrap(<ListToolbar {...toolbarProps(0, {}, false)} />)

    expect(screen.queryByRole('button', { name: 'Отметить все' })).toBeNull()
  })

  it('при отметке панель выбора встаёт на место создания и фильтров', () => {
    wrap(<ListToolbar {...toolbarProps(2)} />)

    expect(screen.getByRole('region', { name: 'Отмеченные заметки' })).toBeTruthy()
    expect(document.querySelector('.notes-panel__toolbar')).toBeNull()
    expect(screen.queryByRole('button', { name: /Заметка/ })).toBeNull()
    expect(document.querySelector('.notes-panel__filters')).toBeNull()
  })
})

describe('CreateActions', () => {
  it('«+ Заметка» открывает выбор фигуры и начинает рисование', () => {
    const onStartDrawing = vi.fn()
    wrap(<CreateActions drawing={false} onCreateGroup={vi.fn()} onStartDrawing={onStartDrawing} />)

    const create = screen.getByRole('button', { name: /Заметка/ })
    expect(create.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(create)
    expect(create.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(screen.getByRole('menuitem', { name: /Многоугольник/ }))

    expect(onStartDrawing).toHaveBeenCalledWith('Polygon')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('пока идёт рисование, новую заметку начать нельзя', () => {
    wrap(<CreateActions drawing onCreateGroup={vi.fn()} onStartDrawing={vi.fn()} />)

    expect((screen.getByRole('button', { name: /Заметка/ }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('«+ Группа» создаёт группу и сохраняет свой id', () => {
    const onCreateGroup = vi.fn()
    wrap(<CreateActions drawing={false} onCreateGroup={onCreateGroup} onStartDrawing={vi.fn()} />)

    const button = screen.getByRole('button', { name: /Группа/ })
    expect(button.id).toBe(NOTES_PANEL_BUTTON_IDS.createGroup)
    fireEvent.click(button)

    expect(onCreateGroup).toHaveBeenCalledTimes(1)
  })
})

describe('PanelHeader', () => {
  it.each(['list', 'properties'] as const)('в режиме %s кнопок создания нет', (mode) => {
    wrap(
      <PanelHeader
        mode={mode}
        search={{ value: '', onChange: vi.fn() }}
        layout="compact"
        onToggleLayout={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /Заметка|Группа|Создать/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeTruthy()
  })
})
