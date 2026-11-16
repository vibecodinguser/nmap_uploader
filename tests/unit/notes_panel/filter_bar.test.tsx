// @vitest-environment happy-dom

/**
 * Панель фильтров: виды, группа, видимость и порядок.
 *
 * Проверяем контракт элементов (id, aria) и то, что каждое изменение уходит
 * наверх одним патчем — состояние фильтров живёт в редьюсере, а не здесь.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterBar } from '@/components/notes_panel/FilterBar'
import { NOTES_PANEL_BUTTON_IDS, rowButtonId } from '@/components/notes_panel/ids'
import { LocaleProvider } from '@/hooks/useLocale'
import { DEFAULT_NOTES_FILTER } from '@/lib/notes/panel/filters'
import { sampleGroup } from '@/tests/unit/notes_panel/list_props'

const renderBar = ({
  filter = DEFAULT_NOTES_FILTER,
  groups = [],
  onChange = vi.fn(),
  onReset = vi.fn(),
}: {
  filter?: typeof DEFAULT_NOTES_FILTER
  groups?: Array<ReturnType<typeof sampleGroup>>
  onChange?: (patch: Partial<typeof DEFAULT_NOTES_FILTER>) => void
  onReset?: () => void
} = {}) => {
  render(
    <LocaleProvider>
      <FilterBar filter={filter} groups={groups} onChange={onChange} onReset={onReset} />
    </LocaleProvider>,
  )
  return { onChange, onReset }
}

afterEach(() => {
  cleanup()
})

describe('фильтр по виду', () => {
  it('показывает все пять видов с устойчивыми id', () => {
    renderBar()

    for (const kind of ['Point', 'Line', 'Polygon', 'Square', 'Circle']) {
      expect(
        document.getElementById(rowButtonId(NOTES_PANEL_BUTTON_IDS.filterKind, kind)),
      ).not.toBeNull()
    }
  })

  it('выбранный вид уходит наверх с добавлением', () => {
    const { onChange } = renderBar()

    fireEvent.click(screen.getByRole('button', { name: 'Линия' }))

    expect(onChange).toHaveBeenCalledWith({ kinds: ['Line'] })
  })

  it('повторный клик снимает вид', () => {
    const { onChange } = renderBar({ filter: { ...DEFAULT_NOTES_FILTER, kinds: ['Line'] } })

    fireEvent.click(screen.getByRole('button', { name: 'Линия' }))

    expect(onChange).toHaveBeenCalledWith({ kinds: [] })
  })

  it('выбранные виды помечены aria-pressed', () => {
    renderBar({ filter: { ...DEFAULT_NOTES_FILTER, kinds: ['Polygon'] } })

    expect(screen.getByRole('button', { name: 'Многоугольник' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Линия' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('фильтр по группе', () => {
  it('без групп селекта нет: фильтровать не по чему', () => {
    renderBar()

    expect(document.getElementById(NOTES_PANEL_BUTTON_IDS.filterGroup)).toBeNull()
  })

  it('с группами даёт «все», «без группы» и сами группы', () => {
    renderBar({ groups: [sampleGroup()] })

    fireEvent.click(screen.getByRole('combobox', { name: 'Фильтр по группе' }))

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Все группы',
      'Без группы',
      'Мосты',
    ])
  })

  it('выбор группы уходит наверх', () => {
    const { onChange } = renderBar({ groups: [sampleGroup()] })

    fireEvent.click(screen.getByRole('combobox', { name: 'Фильтр по группе' }))
    fireEvent.click(screen.getByRole('option', { name: 'Мосты' }))

    expect(onChange).toHaveBeenCalledWith({ group: 'group-1' })
  })

  it('список закрывается после выбора', () => {
    renderBar({ groups: [sampleGroup()] })

    fireEvent.click(screen.getByRole('combobox', { name: 'Фильтр по группе' }))
    fireEvent.click(screen.getByRole('option', { name: 'Мосты' }))

    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('видимость и порядок', () => {
  it('фильтр по видимости уходит наверх', () => {
    const { onChange } = renderBar()

    fireEvent.click(screen.getByRole('combobox', { name: 'Фильтр по видимости' }))
    fireEvent.click(screen.getByRole('option', { name: 'Скрытые с карты' }))

    expect(onChange).toHaveBeenCalledWith({ visibility: 'hidden' })
  })

  it('порядок уходит наверх', () => {
    const { onChange } = renderBar()

    fireEvent.click(screen.getByRole('combobox', { name: 'Порядок' }))
    fireEvent.click(screen.getByRole('option', { name: 'Дата: сначала новые' }))

    expect(onChange).toHaveBeenCalledWith({ sort: 'dateDesc' })
  })
})

describe('сброс', () => {
  it('без фильтров кнопки сброса нет', () => {
    renderBar()

    expect(document.getElementById(NOTES_PANEL_BUTTON_IDS.filterReset)).toBeNull()
  })

  it('с фильтром появляется и сбрасывает всё', () => {
    const { onReset } = renderBar({
      filter: { ...DEFAULT_NOTES_FILTER, kinds: ['Point'] },
    })

    fireEvent.click(document.getElementById(NOTES_PANEL_BUTTON_IDS.filterReset) as HTMLElement)

    expect(onReset).toHaveBeenCalledOnce()
  })

  it('смены только порядка для сброса мало', () => {
    // Порядок не сужает список, поэтому «сбросить фильтры» было бы неправдой.
    renderBar({ filter: { ...DEFAULT_NOTES_FILTER, sort: 'dateDesc' } })

    expect(document.getElementById(NOTES_PANEL_BUTTON_IDS.filterReset)).toBeNull()
  })
})
