// @vitest-environment happy-dom

/**
 * Управление заливкой и штриховкой в свойствах заметки.
 *
 * Показываются они только у площадных видов: у линии и точки заливки нет, и
 * лишние контролы там только путают. Цвет заливки и штриховки не настраивается
 * отдельно — обе рисуются цветом объекта.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HatchPreview } from '@/components/notes_panel/HatchPicker'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { LocaleProvider } from '@/hooks/useLocale'
import { createDefaultStyle } from '@/lib/notes/style_resolution'
import type { Note } from '@/lib/notes/types'

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Polygon',
  name: 'Полигон',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: createDefaultStyle('Polygon'),
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

const renderProps = (target: Note, onPatch = vi.fn()) => {
  render(
    <LocaleProvider>
      <NoteProperties
        note={target}
        fallbackName="14.11.2026 Полигон"
        hidden={false}
        onPatch={onPatch}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        onLocate={vi.fn()}
        onToggleHidden={vi.fn()}
      />
    </LocaleProvider>,
  )
  return onPatch
}

afterEach(() => {
  cleanup()
})

describe('заливка', () => {
  it('есть у многоугольника', () => {
    renderProps(note())

    expect(screen.getByRole('checkbox', { name: 'Заливка' })).toBeTruthy()
  })

  it('выключается и включается цветом объекта', () => {
    const filled = note({ style: { ...createDefaultStyle('Polygon'), fillColor: null } })
    const onPatch = renderProps(filled)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Заливка' }))

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ fillColor: expect.any(String) }),
    })
  })

  it('отдельного цвета заливки в интерфейсе нет', () => {
    renderProps(note())

    expect(screen.queryByText('Цвет заливки')).toBeNull()
  })

  it('цвет объекта тянет заливку за собой', () => {
    const linked = note({
      style: { ...createDefaultStyle('Polygon'), color: '#1a8cff', fillColor: '#1a8cff' },
    })
    const onPatch = renderProps(linked)

    fireEvent.click(screen.getAllByLabelText('#5aa845')[0])

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ color: '#5aa845', fillColor: '#5aa845' }),
    })
  })

  it('выключенная заливка не включается от смены цвета', () => {
    const noFill = note({
      style: { ...createDefaultStyle('Polygon'), color: '#1a8cff', fillColor: null },
    })
    const onPatch = renderProps(noFill)

    fireEvent.click(screen.getAllByLabelText('#5aa845')[0])

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ color: '#5aa845', fillColor: null }),
    })
  })

  it('у линии заливки и штриховки нет', () => {
    renderProps(note({ kind: 'Line', style: createDefaultStyle('Line') }))

    expect(screen.queryByRole('checkbox', { name: 'Заливка' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Штриховка' })).toBeNull()
  })
})

describe('штриховка', () => {
  it('по умолчанию выключена, при включении получает узор', () => {
    const onPatch = renderProps(note({ style: createDefaultStyle('Polygon') }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'Штриховка' }))

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ hatch: { pattern: 'diagonal' } }),
    })
  })

  it('показывает все пять узоров', () => {
    renderProps(
      note({ style: { ...createDefaultStyle('Polygon'), hatch: { pattern: 'diagonal' } } }),
    )

    for (const name of ['Диагональ', 'Обратная диагональ', 'Сетка', 'Точки', 'Горизонталь']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('не показывает ни цвета штриховки, ни толщины линий', () => {
    renderProps(
      note({ style: { ...createDefaultStyle('Polygon'), hatch: { pattern: 'diagonal' } } }),
    )

    expect(screen.queryByText('Цвет штриховки')).toBeNull()
    expect(screen.queryByText('Толщина линий')).toBeNull()
    // Ползунков ровно два: прозрачность и толщина границы.
    expect(screen.getAllByRole('slider')).toHaveLength(2)
  })

  it('переключает узор', () => {
    const onPatch = renderProps(
      note({ style: { ...createDefaultStyle('Polygon'), hatch: { pattern: 'diagonal' } } }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Сетка' }))

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ hatch: { pattern: 'grid' } }),
    })
  })

  it('выключается обратно', () => {
    const onPatch = renderProps(
      note({ style: { ...createDefaultStyle('Polygon'), hatch: { pattern: 'grid' } } }),
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Штриховка' }))

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ hatch: null }),
    })
  })
})

describe('заливка по умолчанию', () => {
  it('новый полигон уже с заливкой', () => {
    renderProps(note())

    const fillCheckbox = screen.getByRole('checkbox', { name: 'Заливка' }) as HTMLInputElement
    expect(fillCheckbox.checked).toBe(true)
  })
})

describe('HatchPreview', () => {
  it('рисует разные узоры по-разному', () => {
    const { container: diagonal } = render(<HatchPreview pattern="diagonal" />)
    const { container: dots } = render(<HatchPreview pattern="dots" />)

    expect(diagonal.innerHTML).not.toBe(dots.innerHTML)
    cleanup()
  })
})
