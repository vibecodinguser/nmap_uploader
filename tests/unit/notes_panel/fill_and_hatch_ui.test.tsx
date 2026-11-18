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
import { HATCH_PREVIEW_SIZE, HatchPreview } from '@/components/notes_panel/HatchPicker'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { LocaleProvider } from '@/hooks/useLocale'
import { createDefaultStyle } from '@/lib/notes/model/style_resolution'
import type { Note } from '@/lib/notes/model/types'
import { sampleGroup } from './list_props'

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

const renderProps = (
  target: Note,
  onPatch = vi.fn(),
  groups: Array<ReturnType<typeof sampleGroup>> = [],
) => {
  render(
    <LocaleProvider>
      <NoteProperties
        note={target}
        fallbackName="14.11.2026 Полигон"
        onPatch={onPatch}
        onBack={vi.fn()}
        groups={groups}
        onMoveToGroup={() => {}}
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

describe('группировка настроек', () => {
  it('заливка, штриховка и подпись стоят в одной рамке', () => {
    renderProps(
      note({ style: { ...createDefaultStyle('Polygon'), hatch: { pattern: 'diagonal' } } }),
    )

    const group = screen.getByRole('group', { name: 'Поверхность' })
    const inside = (name: string) => group.contains(screen.getByRole('checkbox', { name }))

    expect(inside('Заливка')).toBe(true)
    expect(inside('Штриховка')).toBe(true)
    expect(inside('Подпись на карте')).toBe(true)
    // Узор — часть штриховки, поэтому он тоже внутри рамки.
    expect(group.contains(screen.getByRole('button', { name: 'Диагональ' }))).toBe(true)
  })

  it('прозрачность и толщина границы стоят в другой рамке', () => {
    renderProps(note())

    const group = screen.getByRole('group', { name: 'Границы' })
    const sliders = screen.getAllByRole('slider')

    expect(sliders).toHaveLength(2)
    for (const slider of sliders) {
      expect(group.contains(slider)).toBe(true)
    }
  })

  it('у точки рамки с прозрачностью нет: ползунки там ничего не меняют', () => {
    renderProps(note({ kind: 'Point', style: createDefaultStyle('Point') }))

    expect(screen.queryByRole('group', { name: 'Границы' })).toBeNull()
  })

  it('все блоки лежат в одной сетке карточки', () => {
    renderProps(note())

    const grid = document.querySelector('.notes-panel__properties-grid')
    expect(grid).not.toBeNull()

    // Обёртка оформления прозрачна для сетки (`display: contents`), поэтому
    // все четыре блока и поля карточки — её элементы, а не вложенные группы.
    for (const name of ['Иконка', 'Цвет', 'Поверхность', 'Границы']) {
      expect(screen.getByRole('group', { name }).closest('.notes-panel__properties-grid')).toBe(
        grid,
      )
    }
    expect(screen.getByPlaceholderText('Название').closest('.notes-panel__properties-grid')).toBe(
      grid,
    )
  })

  it('места в сетке заданы линиями: название, группа и иконка — первая', () => {
    renderProps(note({ groupId: null }), vi.fn(), [sampleGroup()])

    // Места расставлены через grid-area, а не шириной: проверяем сами классы —
    // именно они держат раскладку 3 / 1 / 4, 4 / 2 / 2, 2.
    expect(document.querySelector('.notes-panel__field--name')).not.toBeNull()
    expect(document.querySelector('.notes-panel__field--group')).not.toBeNull()
    expect(document.querySelector('.notes-panel__field--description')).not.toBeNull()
    expect(document.querySelector('.notes-panel__field-group--icon')).not.toBeNull()
    expect(document.querySelector('.notes-panel__field-group--color')).not.toBeNull()
    expect(document.querySelector('.notes-panel__field-group--stroke')).not.toBeNull()
    expect(document.querySelector('.notes-panel__field-group--surface')).not.toBeNull()
  })
})

describe('HatchPreview', () => {
  const renderPattern = (pattern: Parameters<typeof HatchPreview>[0]['pattern']) => {
    const { container } = render(<HatchPreview pattern={pattern} />)
    return container
  }

  it('рисует разные узоры по-разному', () => {
    const diagonal = renderPattern('diagonal')
    const dots = renderPattern('dots')

    expect(diagonal.innerHTML).not.toBe(dots.innerHTML)
    cleanup()
  })

  it('плитка достаточно крупная, чтобы узор читался', () => {
    const container = renderPattern('diagonal')
    const svg = container.querySelector('svg')

    expect(svg?.getAttribute('width')).toBe(String(HATCH_PREVIEW_SIZE))
    // Меньше 28 px узор снова сливается в пару штрихов.
    expect(HATCH_PREVIEW_SIZE).toBeGreaterThanOrEqual(28)
    cleanup()
  })

  it('узоры замощены, а не нарисованы одним тайлом', () => {
    // Диагональ: 4 линии в поле (2×2 тайла), сетка: 8, точки: 4.
    const diagonal = renderPattern('diagonal')
    const grid = renderPattern('grid')
    const dots = renderPattern('dots')

    expect(diagonal.querySelectorAll('path')).toHaveLength(4)
    expect(grid.querySelectorAll('path')).toHaveLength(8)
    expect(dots.querySelectorAll('circle')).toHaveLength(4)
    cleanup()
  })

  it('линии берут цвет из currentColor, а не жёсткий чёрный', () => {
    const container = renderPattern('diagonal')
    const path = container.querySelector('path')

    expect(path?.getAttribute('stroke')).toBe('currentColor')
    cleanup()
  })
})
