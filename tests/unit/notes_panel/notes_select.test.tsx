// @vitest-environment happy-dom

/**
 * Выпадающий список: раскрытие, выбор и клавиатура.
 *
 * Проверяем именно поведение, которого у системного `select` не было: список
 * рисуется своим попапом, поэтому раскрытие, подсветка и закрытие — наша
 * ответственность, и ломаться они могут молча.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotesSelect } from '@/components/notes_panel/NotesSelect'

const OPTIONS = [
  { value: 'name', label: 'Название: А–Я' },
  { value: 'date', label: 'Дата: старые сначала' },
  { value: 'dateDesc', label: 'Дата: сначала новые' },
]

const renderSelect = ({
  value = 'name',
  onChange = vi.fn(),
}: {
  value?: string
  onChange?: (value: string) => void
} = {}) => {
  render(
    <NotesSelect
      id="test-select"
      label="Порядок"
      value={value}
      options={OPTIONS}
      onChange={onChange}
    />,
  )
  return { onChange }
}

const trigger = (): HTMLElement => screen.getByRole('combobox', { name: 'Порядок' })

afterEach(() => {
  cleanup()
})

describe('раскрытие', () => {
  it('в закрытом виде списка нет', () => {
    renderSelect()

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('клик раскрывает список и помечает кнопку', () => {
    renderSelect()

    fireEvent.click(trigger())

    expect(screen.getByRole('listbox')).not.toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
  })

  it('в кнопке видно текущее значение, а не первое', () => {
    renderSelect({ value: 'dateDesc' })

    expect(trigger().textContent).toBe('Дата: сначала новые')
  })

  it('текущий пункт помечен выбранным', () => {
    renderSelect({ value: 'date' })

    fireEvent.click(trigger())

    expect(
      screen.getByRole('option', { name: 'Дата: старые сначала' }).getAttribute('aria-selected'),
    ).toBe('true')
    expect(
      screen.getByRole('option', { name: 'Дата: сначала новые' }).getAttribute('aria-selected'),
    ).toBe('false')
  })
})

describe('выбор', () => {
  it('клик по пункту отдаёт значение и закрывает список', () => {
    const { onChange } = renderSelect()

    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('option', { name: 'Дата: сначала новые' }))

    expect(onChange).toHaveBeenCalledWith('dateDesc')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('повторный клик по кнопке закрывает список', () => {
    renderSelect()

    fireEvent.click(trigger())
    fireEvent.click(trigger())

    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('клик мимо закрывает список', () => {
    renderSelect()

    fireEvent.click(trigger())
    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('портал', () => {
  it('список живёт в body, а не внутри панели', () => {
    // Панель фильтров вложена в контейнер с `overflow: hidden`: список внутри
    // него обрезался бы при раскрытии вверх.
    render(
      <div className="clipping-ancestor">
        <NotesSelect label="Порядок" value="name" options={OPTIONS} onChange={vi.fn()} />
      </div>,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Порядок' }))

    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull()
    expect(document.querySelector('.clipping-ancestor [role="listbox"]')).toBeNull()
  })

  it('в портале пункты остаются доступны по роли', () => {
    renderSelect()

    fireEvent.click(trigger())

    expect(screen.getAllByRole('option')).toHaveLength(OPTIONS.length)
  })
})

describe('клавиатура', () => {
  it('стрелка вниз раскрывает список', () => {
    renderSelect()

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })

    expect(screen.getByRole('listbox')).not.toBeNull()
  })

  it('стрелка вниз в раскрытом списке двигает подсветку', () => {
    renderSelect()

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })

    // Подсветка идёт от текущего значения: 'name' → 'date'.
    expect(trigger().getAttribute('aria-activedescendant')).toContain('option-1')
  })

  it('Enter выбирает подсвеченный пункт', () => {
    const { onChange } = renderSelect()

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(trigger(), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('date')
  })

  it('Escape закрывает список без выбора', () => {
    const { onChange } = renderSelect()

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(trigger(), { key: 'Escape' })

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('набор букв переводит подсветку на подходящий пункт', () => {
    renderSelect()

    fireEvent.click(trigger())
    // «д» — начало подписи «Дата…», подсветка уходит на первый пункт с «Д».
    fireEvent.keyDown(trigger(), { key: 'д' })

    expect(trigger().getAttribute('aria-activedescendant')).toContain('option-1')
  })
})
