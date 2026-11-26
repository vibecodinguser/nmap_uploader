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
  nspdButton: {
    isEnabled: false,
    isLoaded: true,
    setIsEnabled: noop,
    permissionDenied: null,
    requestAccess: noop,
  },
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
    moveItemBy: noop,
    reorderItems: noop,
  },
})

const renderTab = (props = buildProps()) =>
  render(<SettingsTab {...props} />, { wrapper: LocaleProvider })

const tabNames = ['Редактор', 'Модерация', 'Стиль'] as const

const getTab = (name: string) => screen.getByRole('tab', { name })

const getPanel = () => screen.getByRole('tabpanel')

const stubGeometry = (element: HTMLElement, left: number, width: number): void => {
  Object.defineProperty(element, 'offsetLeft', { value: left, configurable: true })
  Object.defineProperty(element, 'offsetWidth', { value: width, configurable: true })
}

const selectionTransform = (): string | undefined =>
  screen.getByTestId('settings-tabs-selection').style.transform

describe('SettingsTab: полоса вкладок', () => {
  afterEach(cleanup)

  it('показывает три раздела нативным таббаром', () => {
    renderTab()

    const tablist = screen.getByRole('tablist', { name: 'Разделы настроек' })

    expect(tablist.className).toBe('nk-tabs-bar__tabs')
    expect(tablist.closest('.nk-tabs-bar')?.className).toContain('nk-section_level_1')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([...tabNames])
  })

  it('ставит вкладки друг за другом: «Редактор», «Модерация», «Стиль»', () => {
    renderTab()

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Редактор', 'Модерация', 'Стиль'])
  })

  it('по умолчанию открыта вкладка «Редактор»', () => {
    renderTab()

    expect(getTab('Редактор').getAttribute('aria-selected')).toBe('true')
    expect(getTab('Модерация').getAttribute('aria-selected')).toBe('false')
    expect(getTab('Стиль').getAttribute('aria-selected')).toBe('false')
    expect(getPanel().id).toBe('settings-panel-editing')
  })

  it('держит в DOM ровно одну панель и связывает её с вкладкой', () => {
    renderTab()

    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(getPanel().getAttribute('aria-labelledby')).toBe('settings-tab-editing')
    expect(getTab('Редактор').getAttribute('aria-controls')).toBe('settings-panel-editing')
  })

  it('переключает раздел по клику', () => {
    renderTab()

    fireEvent.click(getTab('Модерация'))

    expect(getTab('Модерация').getAttribute('aria-selected')).toBe('true')
    expect(getPanel().id).toBe('settings-panel-moderation')
    expect(within(getPanel()).getByRole('switch', { name: 'Фильтр истории правок' })).toBeTruthy()
    expect(within(getPanel()).queryByRole('switch', { name: 'Счётчик вершин' })).toBeNull()
  })

  it('в таб-потоке держит только активную вкладку', () => {
    renderTab()

    expect(getTab('Редактор').getAttribute('tabindex')).toBe('0')
    expect(getTab('Модерация').getAttribute('tabindex')).toBe('-1')
    expect(getTab('Стиль').getAttribute('tabindex')).toBe('-1')

    fireEvent.click(getTab('Стиль'))

    expect(getTab('Редактор').getAttribute('tabindex')).toBe('-1')
    expect(getTab('Стиль').getAttribute('tabindex')).toBe('0')
  })

  it('переключает вкладки стрелками и Home/End', () => {
    renderTab()

    fireEvent.keyDown(getTab('Редактор'), { key: 'ArrowRight' })
    expect(getTab('Модерация').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(getTab('Модерация'))

    fireEvent.keyDown(getTab('Модерация'), { key: 'ArrowRight' })
    expect(getTab('Стиль').getAttribute('aria-selected')).toBe('true')

    // Стрелка вправо с последней вкладки возвращается к первой.
    fireEvent.keyDown(getTab('Стиль'), { key: 'ArrowRight' })
    expect(getTab('Редактор').getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(getTab('Редактор'), { key: 'ArrowLeft' })
    expect(getTab('Стиль').getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(getTab('Стиль'), { key: 'Home' })
    expect(getTab('Редактор').getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(getTab('Редактор'), { key: 'End' })
    expect(getTab('Стиль').getAttribute('aria-selected')).toBe('true')
  })

  it('ставит полосу под выбранную вкладку', () => {
    renderTab()

    const editing = getTab('Редактор')
    const moderation = getTab('Модерация')
    stubGeometry(editing, 8, 100)
    stubGeometry(moderation, 108, 80)

    fireEvent.click(moderation)

    expect(selectionTransform()).toBe('translateX(147.5px) scaleX(80)')
  })

  it('не двигает полосу, пока ширина вкладок неизвестна', () => {
    renderTab()

    fireEvent.click(getTab('Стиль'))

    expect(selectionTransform()).toBe('')
  })
})

describe('SettingsTab: содержимое раздела «Редактор»', () => {
  afterEach(cleanup)

  it('объединяет настройки кнопок, счётчика, геосервисов и автообновления', () => {
    renderTab()

    const panel = getPanel()
    const names = [
      'Раздельный вид',
      'Заметки',
      'Загрузка из НСПД',
      'Счётчик вершин',
      'Отображать кнопку',
      'Автообновление после загрузки',
    ]

    for (const name of names) {
      expect(within(panel).getByRole('switch', { name })).toBeTruthy()
    }
  })

  it('располагает строки в заданном порядке', () => {
    renderTab()

    const titles = Array.from(
      getPanel().querySelectorAll('.settings-toggle-item .settings-section-title'),
    ).map((node) => node.textContent)

    expect(titles).toEqual([
      'Раздельный вид',
      'Заметки',
      'Загрузка из НСПД',
      'Внешние геосервисы',
      'Счётчик вершин',
      'Автообновление после загрузки',
    ])
  })

  it('оставляет список геосервисов внутри своей строки', () => {
    renderTab()

    const goToRow = within(getPanel())
      .getByRole('switch', { name: 'Отображать кнопку' })
      .closest('.settings-toggle-item')

    expect(goToRow).not.toBeNull()
    expect(within(goToRow as HTMLElement).getByRole('button', { name: /Список/ })).toBeTruthy()
  })
})

describe('SettingsTab: содержимое раздела «Модерация»', () => {
  afterEach(cleanup)

  it('объединяет фильтр истории правок и наблюдение за объектами', () => {
    renderTab()
    fireEvent.click(getTab('Модерация'))

    const panel = getPanel()

    expect(within(panel).getByRole('switch', { name: 'Фильтр истории правок' })).toBeTruthy()
    expect(within(panel).getByRole('switch', { name: 'Наблюдение за объектами' })).toBeTruthy()
  })

  it('не показывает период опроса: он фиксированный', () => {
    renderTab()
    fireEvent.click(getTab('Модерация'))

    const panel = getPanel()

    expect(within(panel).queryByText('Период опроса')).toBeNull()
    expect(within(panel).queryByRole('radiogroup')).toBeNull()
  })

  it('передаёт клик по тумблеру фильтра в обработчик настройки', () => {
    const setIsEnabled = vi.fn()
    const props = buildProps()
    props.feedsFilter.setIsEnabled = setIsEnabled

    renderTab(props)
    fireEvent.click(getTab('Модерация'))
    within(getPanel()).getByRole('switch', { name: 'Фильтр истории правок' }).click()

    expect(setIsEnabled).toHaveBeenCalledWith(false)
  })
})

describe('SettingsTab: содержимое раздела «Стиль»', () => {
  afterEach(cleanup)

  it('содержит настройку обводки контура загруженного объекта', () => {
    renderTab()
    fireEvent.click(getTab('Стиль'))

    const panel = getPanel()

    expect(
      within(panel).getByRole('textbox', { name: 'Обводка контура загруженного объекта' }),
    ).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'Применить' })).toBeTruthy()
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

  it('остаётся видимым на любой вкладке', () => {
    renderTab()

    for (const name of tabNames) {
      fireEvent.click(getTab(name))
      expect(screen.getByRole('link', { name: 'Предложить функцию' })).toBeTruthy()
    }
  })

  it('стоит вне прокручиваемой панели вкладки', () => {
    renderTab()

    const about = document.querySelector('.settings-section--about')
    const panel = getPanel()

    expect(about).not.toBeNull()
    expect(panel.contains(about)).toBe(false)
  })
})

describe('SettingsTab: аккордеон заменён вкладками', () => {
  afterEach(cleanup)

  it('не оставляет карточек-аккордеонов и кнопок сворачивания', () => {
    renderTab()

    expect(document.querySelector('.settings-section--group')).toBeNull()
    expect(document.querySelector('.settings-section-toggle')).toBeNull()
  })

  it('не показывает кнопку «Назад»: закрытие даёт шапка попапа', () => {
    renderTab()

    expect(document.querySelector('.settings-back-btn')).toBeNull()
  })
})
