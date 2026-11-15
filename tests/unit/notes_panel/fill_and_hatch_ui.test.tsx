// @vitest-environment happy-dom

/**
 * Управление заливкой и штриховкой в свойствах заметки.
 *
 * Показываться они должны только у площадных видов: у линии и точки заливки
 * нет, и лишние контролы там только путают.
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

  it('выключается и включается', () => {
    const filled = note({ style: { ...createDefaultStyle('Polygon'), fillColor: null } })
    const onPatch = renderProps(filled)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Заливка' }))

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ fillColor: expect.any(String) }),
    })
  })

  it('цвет заливки выбирается отдельно от цвета объекта', () => {
    const styled = note({
      style: { ...createDefaultStyle('Polygon'), color: '#1a8cff', fillColor: '#5aa845' },
    })
    const onPatch = renderProps(styled)

    fireEvent.click(screen.getAllByLabelText('#e96b7c').at(-1) as HTMLElement)

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ color: '#1a8cff', fillColor: '#e96b7c' }),
    })
  })

  it('цвет объекта тянет заливку за собой, пока её не переопределили', () => {
    const linked = note({
      style: { ...createDefaultStyle('Polygon'), color: '#1a8cff', fillColor: '#1a8cff' },
    })
    const onPatch = renderProps(linked)

    fireEvent.click(screen.getAllByLabelText('#5aa845')[0])

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ color: '#5aa845', fillColor: '#5aa845' }),
    })
  })

  it('переопределённая заливка не следует за цветом объекта', () => {
    const overridden = note({
      style: { ...createDefaultStyle('Polygon'), color: '#1a8cff', fillColor: '#c44fa0' },
    })
    const onPatch = renderProps(overridden)

    fireEvent.click(screen.getAllByLabelText('#5aa845')[0])

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ color: '#5aa845', fillColor: '#c44fa0' }),
    })
  })

  it('у линии заливки и штриховки нет', () => {
    renderProps(note({ kind: 'Line', style: createDefaultStyle('Line') }))

    expect(screen.queryByRole('checkbox', { name: 'Заливка' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Штриховка' })).toBeNull()
  })
})

describe('штриховка', () => {
  it('по умолчанию выключена, при включении получает узор и цвет', () => {
    const onPatch = renderProps(note({ style: createDefaultStyle('Polygon') }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'Штриховка' }))

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({
        hatch: expect.objectContaining({ pattern: 'diagonal', width: 2 }),
      }),
    })
  })

  it('показывает все пять узоров', () => {
    renderProps(
      note({
        style: {
          ...createDefaultStyle('Polygon'),
          hatch: { pattern: 'diagonal', color: '#1f1f1f', width: 2 },
        },
      }),
    )

    for (const name of ['Диагональ', 'Обратная диагональ', 'Сетка', 'Точки', 'Горизонталь']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('переключает узор', () => {
    const onPatch = renderProps(
      note({
        style: {
          ...createDefaultStyle('Polygon'),
          hatch: { pattern: 'diagonal', color: '#1f1f1f', width: 2 },
        },
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Сетка' }))

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({
        hatch: expect.objectContaining({ pattern: 'grid' }),
      }),
    })
  })

  it('меняет цвет штриховки', () => {
    const onPatch = renderProps(
      note({
        style: {
          ...createDefaultStyle('Polygon'),
          hatch: { pattern: 'grid', color: '#1f1f1f', width: 2 },
        },
      }),
    )

    fireEvent.click(screen.getAllByLabelText('#c44fa0').at(-1) as HTMLElement)

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({
        hatch: expect.objectContaining({ color: '#c44fa0' }),
      }),
    })
  })

  it('меняет толщину линий', () => {
    const onPatch = renderProps(
      note({
        style: {
          ...createDefaultStyle('Polygon'),
          hatch: { pattern: 'grid', color: '#1f1f1f', width: 1 },
        },
      }),
    )

    // Толщина линий штриховки — единственный ползунок с шагом 1..3.
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[]
    const hatchWidth = sliders.find(
      (slider) => slider.min === '1' && slider.max === '3',
    ) as HTMLInputElement
    fireEvent.input(hatchWidth, { target: { value: '3' } })

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({
        hatch: expect.objectContaining({ width: 3 }),
      }),
    })
  })

  it('выключается обратно', () => {
    const onPatch = renderProps(
      note({
        style: {
          ...createDefaultStyle('Polygon'),
          hatch: { pattern: 'grid', color: '#1f1f1f', width: 2 },
        },
      }),
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Штриховка' }))

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ hatch: null }),
    })
  })
})

describe('HatchPreview', () => {
  it('рисует разные узоры по-разному', () => {
    const { container: diagonal } = render(<HatchPreview pattern="diagonal" color="#000000" />)
    const { container: dots } = render(<HatchPreview pattern="dots" color="#000000" />)

    expect(diagonal.innerHTML).not.toBe(dots.innerHTML)
    cleanup()
  })
})

describe('заливка по умолчанию', () => {
  it('новый полигон уже с заливкой цвета объекта', () => {
    renderProps(note())

    const fillCheckbox = screen.getByRole('checkbox', { name: 'Заливка' }) as HTMLInputElement
    expect(fillCheckbox.checked).toBe(true)
  })

  it('у нового полигона заливка следует за цветом объекта', () => {
    // Цвет объекта не задан: он берётся из палитры, и заливка совпадает с ним.
    const onPatch = renderProps(note({ style: createDefaultStyle('Polygon') }))

    fireEvent.click(screen.getAllByLabelText('#5aa845')[0])

    expect(onPatch).toHaveBeenCalledWith({
      style: expect.objectContaining({ color: '#5aa845', fillColor: '#5aa845' }),
    })
  })
})
