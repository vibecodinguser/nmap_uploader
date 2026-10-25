// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFilterDropdownElement,
  ensureFeedFilterStyles,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  FEEDS_FILTER_STYLES_ID,
  syncFilterDropdownHeight,
} from '@/lib/feeds_filter'

describe('FeedsFilter DOM Dropdown (TDD slice)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    const existingStyle = document.getElementById(FEEDS_FILTER_STYLES_ID)
    if (existingStyle) {
      existingStyle.remove()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ensureFeedFilterStyles добавляет тег style с нужным id в head один раз', () => {
    ensureFeedFilterStyles()
    const styleEl = document.getElementById(FEEDS_FILTER_STYLES_ID)
    expect(styleEl).not.toBeNull()
    expect(styleEl?.tagName.toLowerCase()).toBe('style')

    // Повторный вызов не дублирует
    ensureFeedFilterStyles()
    expect(document.querySelectorAll(`#${FEEDS_FILTER_STYLES_ID}`)).toHaveLength(1)
  })

  it('createFilterDropdownElement создает элементы селекта и попапа с начальным состоянием', () => {
    const onFilterChange = vi.fn()
    const controller = createFilterDropdownElement(onFilterChange, 'all')

    expect(controller.element.id).toBe(FEEDS_FILTER_SELECT_ID)
    expect(controller.popupElement.id).toBe(FEEDS_FILTER_POPUP_ID)

    // Проверяем текст кнопки
    const label = controller.element.querySelector('.nk-button__text')
    expect(label?.textContent).toContain('Все статусы')

    // Обновление счетчиков
    controller.updateCounters({
      total: 10,
      published: 3,
      green: 4,
      yellow: 2,
      red: 1,
    })

    const countBadge = controller.element.querySelector('.nmap-status-count-badge')
    expect(countBadge?.textContent).toBe('10')

    // Смена фильтра
    controller.setActiveFilter('published')
    expect(countBadge?.textContent).toBe('3')

    // Очистка
    controller.teardown()
    expect(document.getElementById(FEEDS_FILTER_SELECT_ID)).toBeNull()
  })

  it('syncFilterDropdownHeight устанавливает высоту селекта по умолчанию 32px без referenceSelect', () => {
    const el = document.createElement('span')
    const height = syncFilterDropdownHeight(el)
    expect(height).toBe(32)
    expect(el.style.getPropertyValue('--nmap-feeds-select-height')).toBe('32px')
  })

  it('создает секцию выбора периода в попапе и реагирует на клики и изменение состояния', () => {
    const onFilterChange = vi.fn()
    const onPeriodChange = vi.fn()
    const onStopLoading = vi.fn()

    const controller = createFilterDropdownElement(onFilterChange, 'all', {
      initialDays: 1,
      onPeriodChange,
      onStopLoading,
    })

    const popup = controller.popupElement
    const periodSection = popup.querySelector('.nmap-feeds-period-section')
    expect(periodSection).not.toBeNull()

    // Кнопки 1 дн., 3 дн., 7 дн.
    const periodButtons = popup.querySelectorAll<HTMLButtonElement>('.nmap-feeds-period-btn')
    expect(periodButtons.length).toBe(3)
    expect(periodButtons[0].textContent).toBe('1 дн.')
    expect(periodButtons[1].textContent).toBe('3 дн.')
    expect(periodButtons[2].textContent).toBe('7 дн.')
    expect(periodButtons[0].classList.contains('nmap-feeds-period-btn_active')).toBe(true)

    // Клик по 3 дн.
    periodButtons[1].click()
    expect(onPeriodChange).toHaveBeenCalledWith(3)

    // Кнопка остановки
    const stopBtn = popup.querySelector<HTMLButtonElement>('.nmap-feeds-period-stop-btn')
    expect(stopBtn).not.toBeNull()
    expect(stopBtn?.style.display).toBe('none')

    // Обновление состояния во время загрузки
    controller.updatePeriodState({
      activeDays: 3,
      targetDays: 3,
      isLoading: true,
      loadedCardsCount: 15,
    })

    const statusText = popup.querySelector('.nmap-feeds-period-status-text')
    expect(statusText?.textContent).toContain('Загрузка (3 дн.): 15 шт.')
    expect(stopBtn?.style.display).toBe('inline-block')

    // Клик по «Остановить»
    stopBtn?.click()
    expect(onStopLoading).toHaveBeenCalledTimes(1)

    // Спиннер кнопки
    const spinner = controller.element.querySelector<HTMLElement>('.nmap-feeds-button-spinner')
    expect(spinner).not.toBeNull()
    expect(spinner?.style.display).toBe('none')

    controller.setLoadingState(true)
    expect(spinner?.style.display).toBe('inline-block')

    controller.setLoadingState(false)
    expect(spinner?.style.display).toBe('none')

    controller.teardown()
  })
})
