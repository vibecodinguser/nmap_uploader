// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsTab } from '@/components/SettingsTab'
import { LocaleProvider } from '@/hooks/useLocale'

const noop = () => {}

const buildProps = () => ({
  themeMode: 'system' as const,
  onThemeModeChange: noop,
  strokeColor: {
    inputValue: 'ff0000',
    effectiveColor: '#ff0000',
    validationError: null,
    applyStatus: 'idle' as const,
    isLoaded: true,
    isApplying: false,
    canApply: true,
    handleInputChange: noop,
    handleApply: async () => {},
  },
  reloadAfterUpload: { isEnabled: false, isLoaded: true, setIsEnabled: noop, canChange: true },
  splitViewButton: { isEnabled: true, isLoaded: true, setIsEnabled: noop },
  notesButton: { isEnabled: true, isLoaded: true, setIsEnabled: noop },
  nspdButton: { isEnabled: false, isLoaded: true, setIsEnabled: noop, permissionDenied: false },
  feedsFilter: { isEnabled: true, isLoaded: true, setIsEnabled: noop },
  objectTracker: {
    isEnabled: true,
    isLoaded: true,
    intervalMinutes: 30,
    setIsEnabled: noop,
    setIntervalMinutes: noop,
  },
  pointCounter: { isEnabled: true, isLoaded: true, setIsEnabled: noop },
  goToLinks: {
    isMenuEnabled: true,
    isLoaded: true,
    items: [],
    setIsMenuEnabled: noop,
    setItemActive: noop,
    moveItemUp: noop,
    moveItemDown: noop,
  },
})

const renderTab = (props = buildProps()) =>
  render(<SettingsTab {...props} />, { wrapper: LocaleProvider })

const sectionNames = (name: string) => screen.getByRole('region', { name })

const expandSection = (name: string) => {
  const section = sectionNames(name)
  const toggle = within(section).getByRole('button', { name })

  if (toggle.getAttribute('aria-expanded') === 'false') {
    fireEvent.click(toggle)
  }

  return section
}

describe('SettingsTab: секция «Оформление»', () => {
  afterEach(cleanup)

  it('объединяет язык и тему', () => {
    renderTab()

    const section = sectionNames('Оформление')

    expect(within(section).getByRole('radiogroup', { name: 'Язык интерфейса' })).toBeTruthy()
    expect(within(section).getByRole('radiogroup', { name: 'Тема оформления' })).toBeTruthy()
  })

  it('делает язык и тему строками внутри секции', () => {
    renderTab()

    const subheadings = screen.getAllByRole('heading', { level: 4 }).map((node) => node.textContent)

    expect(subheadings).toContain('Язык')
    expect(subheadings).toContain('Тема')
  })

  it('не выводит язык и тему отдельными карточками', () => {
    renderTab()

    const standaloneSections = Array.from(
      document.querySelectorAll(
        '.settings-section:not(.settings-section--group):not(.settings-section--about)',
      ),
    )

    expect(standaloneSections).toHaveLength(0)
  })
})

describe('SettingsTab: раскрывающиеся секции', () => {
  afterEach(cleanup)

  it('по умолчанию раскрыта только секция «Оформление»', () => {
    renderTab()

    const expected = [
      ['Оформление', 'true'],
      ['Редактирование', 'false'],
      ['Модерация', 'false'],
      ['Стиль', 'false'],
    ] as const

    for (const [name, expanded] of expected) {
      const toggle = within(sectionNames(name)).getByRole('button', { name })
      expect(toggle.getAttribute('aria-expanded')).toBe(expanded)
    }
  })

  it('свёрнутая секция показывает только заголовок', () => {
    renderTab()

    const section = sectionNames('Редактирование')

    expect(within(section).queryByRole('switch', { name: 'Счётчик вершин' })).toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: 'Редактирование' })).toBeTruthy()
  })

  it('раскрывает содержимое по клику', () => {
    renderTab()

    const section = expandSection('Модерация')

    expect(within(section).getByRole('switch', { name: 'Фильтр истории правок' })).toBeTruthy()
  })

  it('повторный клик сворачивает содержимое', () => {
    renderTab()

    const section = expandSection('Модерация')
    const toggle = within(section).getByRole('button', { name: 'Модерация' })

    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(within(section).queryByRole('switch', { name: 'Фильтр истории правок' })).toBeNull()
  })

  it('секции независимы друг от друга', () => {
    renderTab()

    expandSection('Редактирование')

    const moderationToggle = within(sectionNames('Модерация')).getByRole('button', {
      name: 'Модерация',
    })

    expect(moderationToggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('управляется с клавиатуры', () => {
    renderTab()

    const section = sectionNames('Стиль')
    const toggle = within(section).getByRole('button', { name: 'Стиль' })

    toggle.focus()
    fireEvent.click(toggle)

    expect(document.activeElement).toBe(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('SettingsTab: секция «Редактирование»', () => {
  afterEach(cleanup)

  it('объединяет настройки кнопок, счётчика, геосервисов и автообновления', () => {
    renderTab()

    const section = expandSection('Редактирование')
    const names = [
      'Раздельный вид',
      'Заметки',
      'НСПД',
      'Счётчик вершин',
      'Отображать кнопку',
      'Автообновление после загрузки',
    ]

    for (const name of names) {
      expect(within(section).getByRole('switch', { name })).toBeTruthy()
    }
  })

  it('располагает строки в заданном порядке', () => {
    renderTab()

    const section = expandSection('Редактирование')
    const titles = Array.from(
      section.querySelectorAll('.settings-toggle-item .settings-section-title'),
    ).map((node) => node.textContent)

    expect(titles).toEqual([
      'Кнопка: Раздельный вид',
      'Кнопка: Заметки',
      'Кнопка: НСПД',
      'Кнопка: Внешние геосервисы',
      'Счётчик вершин',
      'Автообновление после загрузки',
    ])
  })

  it('оставляет список геосервисов внутри своей строки', () => {
    renderTab()

    const section = expandSection('Редактирование')
    const goToRow = within(section)
      .getByRole('switch', { name: 'Отображать кнопку' })
      .closest('.settings-toggle-item')

    expect(goToRow).not.toBeNull()
    expect(within(goToRow as HTMLElement).getByRole('button', { name: /Список/ })).toBeTruthy()
  })

  it('не выводит перенесённые настройки отдельными карточками', () => {
    renderTab()

    const standaloneSections = Array.from(
      document.querySelectorAll('.settings-section:not(.settings-section--group)'),
    )
    const toggleIds = standaloneSections.flatMap((node) =>
      Array.from(node.querySelectorAll('input[type="checkbox"]')).map((input) => input.id),
    )

    expect(toggleIds).not.toContain('settings-split-view-button')
    expect(toggleIds).not.toContain('settings-notes-button')
    expect(toggleIds).not.toContain('settings-nspd-button')
    expect(toggleIds).not.toContain('settings-point-counter')
    expect(toggleIds).not.toContain('settings-go-to-menu-enabled')
    expect(toggleIds).not.toContain('settings-reload-after-upload')
  })
})

describe('SettingsTab: секция «Модерация»', () => {
  afterEach(cleanup)

  it('объединяет фильтр истории правок и наблюдение за объектами', () => {
    renderTab()

    const section = expandSection('Модерация')

    expect(within(section).getByRole('switch', { name: 'Фильтр истории правок' })).toBeTruthy()
    expect(within(section).getByRole('switch', { name: 'Наблюдение за объектами' })).toBeTruthy()
  })

  it('оставляет период опроса внутри наблюдения за объектами', () => {
    renderTab()

    const section = expandSection('Модерация')
    const intervalGroup = within(section).getByRole('radiogroup', {
      name: 'Период опроса истории объектов',
    })

    expect(within(section).getByText('Период опроса')).toBeTruthy()
    expect(within(intervalGroup).getAllByRole('radio')).toHaveLength(4)
  })

  it('передаёт клик по тумблеру фильтра в обработчик настройки', () => {
    const setIsEnabled = vi.fn()
    const props = buildProps()
    props.feedsFilter.setIsEnabled = setIsEnabled

    renderTab(props)
    expandSection('Модерация')
    screen.getByRole('switch', { name: 'Фильтр истории правок' }).click()

    expect(setIsEnabled).toHaveBeenCalledWith(false)
  })
})

describe('SettingsTab: секция «Стиль»', () => {
  afterEach(cleanup)

  it('содержит настройку обводки контура загруженного объекта', () => {
    renderTab()

    const section = expandSection('Стиль')

    expect(
      within(section).getByRole('textbox', { name: 'Обводка контура загруженного объекта' }),
    ).toBeTruthy()
    expect(within(section).getByRole('button', { name: 'Применить' })).toBeTruthy()
  })
})

describe('SettingsTab: порядок секций', () => {
  afterEach(cleanup)

  it('ставит «Редактирование», «Модерацию» и «Стиль» друг за другом', () => {
    renderTab()

    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)
    const editingIndex = headings.indexOf('Редактирование')
    const moderationIndex = headings.indexOf('Модерация')
    const styleIndex = headings.indexOf('Стиль')

    expect(editingIndex).toBeGreaterThan(-1)
    expect(moderationIndex).toBe(editingIndex + 1)
    expect(styleIndex).toBe(moderationIndex + 1)
  })
})
