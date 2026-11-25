// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsTab } from '@/components/SettingsTab'
import { LocaleProvider } from '@/hooks/useLocale'

const noop = () => {}

const buildProps = () => ({
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
  notesButton: { isEnabled: true, isLoaded: true, setIsEnabled: noop, permissionDenied: false },
  nspdButton: { isEnabled: false, isLoaded: true, setIsEnabled: noop, permissionDenied: null },
  feedsFilter: { isEnabled: true, isLoaded: true, setIsEnabled: noop },
  objectTracker: {
    isEnabled: true,
    isLoaded: true,
    setIsEnabled: noop,
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

describe('SettingsTab: язык и тема', () => {
  afterEach(cleanup)

  it('не предлагает ручной выбор языка: язык следует за редактором', () => {
    renderTab()

    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByText('Язык интерфейса')).toBeNull()
  })

  it('не предлагает ручной выбор темы', () => {
    renderTab()

    expect(screen.queryByRole('radiogroup', { name: 'Тема оформления' })).toBeNull()
  })

  it('не выводит пустую группу настроек', () => {
    renderTab()

    const standaloneSections = Array.from(
      document.querySelectorAll(
        '.settings-section:not(.settings-section--group):not(.settings-section--about)',
      ),
    )

    expect(standaloneSections).toHaveLength(0)
    expect(screen.queryByRole('region', { name: 'Оформление' })).toBeNull()
  })
})

describe('SettingsTab: раскрывающиеся секции', () => {
  afterEach(cleanup)

  it('по умолчанию раскрыта только секция «Редактирование»', () => {
    renderTab()

    const expected = [
      ['Редактирование', 'true'],
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

    const section = sectionNames('Модерация')

    expect(within(section).queryByRole('switch', { name: 'Фильтр истории правок' })).toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: 'Модерация' })).toBeTruthy()
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

  it('не показывает период опроса: он фиксированный', () => {
    renderTab()

    const section = expandSection('Модерация')

    expect(within(section).queryByText('Период опроса')).toBeNull()
    expect(
      within(section).queryByRole('radiogroup', { name: 'Период опроса истории объектов' }),
    ).toBeNull()
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

describe('SettingsTab: блок «О версии»', () => {
  afterEach(cleanup)

  it('ведёт на обсуждения по ссылке «Предложить функцию»', () => {
    renderTab()

    const link = screen.getByRole('link', { name: 'Предложить функцию' })

    expect(link.getAttribute('href')).toBe('https://github.com/vibecodinguser/yamapper/discussions')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
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
