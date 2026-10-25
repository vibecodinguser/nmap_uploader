// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createActionFilterDropdownElement,
  FEEDS_ACTION_FILTER_POPUP_ID,
  FEEDS_ACTION_FILTER_SELECT_ID,
} from '@/lib/feeds_filter'

describe('ActionFilter DOM Dropdown (TDD slice)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createActionFilterDropdownElement создает элементы селекта действий и попапа', () => {
    const onActionChange = vi.fn()
    const controller = createActionFilterDropdownElement(onActionChange, 'all')

    expect(controller.element.id).toBe(FEEDS_ACTION_FILTER_SELECT_ID)
    expect(controller.popupElement.id).toBe(FEEDS_ACTION_FILTER_POPUP_ID)

    // Проверяем текст кнопки
    const label = controller.element.querySelector('.nmap-feeds-button-label')
    expect(label?.textContent).toBe('Все действия')

    // Обновление счетчиков
    controller.updateCounters({
      total: 10,
      delete: 2,
      edit: 5,
      create: 3,
    })

    const countBadge = controller.element.querySelector('.nmap-status-count-badge')
    expect(countBadge?.textContent).toBe('10')

    // Смена фильтра на "create"
    controller.setActiveFilter('create')
    expect(countBadge?.textContent).toBe('3')
    expect(label?.textContent).toBe('Создание')

    // Очистка
    controller.teardown()
    expect(document.getElementById(FEEDS_ACTION_FILTER_SELECT_ID)).toBeNull()
  })

  it('вызывает onActionChange при выборе пункта меню в попапе', () => {
    const onActionChange = vi.fn()
    const controller = createActionFilterDropdownElement(onActionChange, 'all')

    const deleteOption =
      controller.popupElement.querySelector<HTMLElement>('[data-action="delete"]')
    expect(deleteOption).not.toBeNull()

    deleteOption?.click()
    expect(onActionChange).toHaveBeenCalledWith('delete')

    controller.teardown()
  })
})
