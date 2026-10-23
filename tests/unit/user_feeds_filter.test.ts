// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyFeedFilter,
  attachFilterDropdownToDom,
  createFeedDailyLoader,
  createFilterDropdownElement,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  findFeedContainer,
  findTargetSelect,
  getEventCardStatus,
  getStoredFeedsFilterEnabled,
  parseEventDateString,
  setStoredFeedsFilterEnabled,
} from '@/lib/user_feeds_filter'
import { resetBrowserMocks } from '../setup/browser_mock'

describe('user_feeds_filter integration facade', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    document.body.innerHTML = ''
  })

  it('экспортирует целостный публичный фасад фильтрации ленты', () => {
    expect(typeof applyFeedFilter).toBe('function')
    expect(typeof attachFilterDropdownToDom).toBe('function')
    expect(typeof createFeedDailyLoader).toBe('function')
    expect(typeof createFilterDropdownElement).toBe('function')
    expect(typeof findFeedContainer).toBe('function')
    expect(typeof findTargetSelect).toBe('function')
    expect(typeof getEventCardStatus).toBe('function')
    expect(typeof parseEventDateString).toBe('function')
    expect(typeof getStoredFeedsFilterEnabled).toBe('function')
    expect(typeof setStoredFeedsFilterEnabled).toBe('function')
  })

  it('полный сценарий интеграции: монтирование дропдауна, фильтрация карточек и очистка', () => {
    const container = document.createElement('div')
    container.className = 'nk-user-feeds-view'

    const targetSelect = document.createElement('span')
    targetSelect.className = 'nk-select nk-select_theme_islands nk-select_size_m'
    const targetButton = document.createElement('button')
    targetButton.className = 'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
    const textSpan = document.createElement('span')
    textSpan.className = 'nk-button__text'
    textSpan.textContent = 'Правки'
    targetButton.appendChild(textSpan)
    targetSelect.appendChild(targetButton)
    container.appendChild(targetSelect)

    const card1 = document.createElement('div')
    card1.className = 'nk-event-view'
    card1.innerHTML =
      '<span class="nk-icon nk-icon_id_commit-published nk-commit-state-view nk-event-view__commit-state">Правка 1</span>'
    container.appendChild(card1)

    const card2 = document.createElement('div')
    card2.className = 'nk-event-view'
    card2.innerHTML =
      '<span class="nk-badge nk-badge_color_red nk-event-view__badge">Правка 2</span>'
    container.appendChild(card2)

    document.body.appendChild(container)

    let currentStatus = 'all'
    const controller = createFilterDropdownElement((status) => {
      currentStatus = status
      applyFeedFilter(container, status)
    })

    const attached = attachFilterDropdownToDom(controller.element, container)
    expect(attached).toBe(true)
    expect(document.getElementById(FEEDS_FILTER_SELECT_ID)).toBeDefined()

    // Исходная статистика и фильтрация
    const stats = applyFeedFilter(container, 'red')
    expect(stats.total).toBe(2)
    expect(stats.published).toBe(1)
    expect(stats.red).toBe(1)

    // Переключение через контроллер
    controller.setActiveFilter('published')
    expect(currentStatus).toBe('all') // setActiveFilter меняет UI, клики инициируют callback

    controller.teardown()
    expect(document.getElementById(FEEDS_FILTER_POPUP_ID)).toBeNull()
  })
})
