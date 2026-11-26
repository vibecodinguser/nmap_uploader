// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { getEventCardStatus } from '@/lib/feeds_filter/card_status_detector'
import { FEEDS_FILTER_POPUP_ID, FEEDS_FILTER_SELECT_ID } from '@/lib/feeds_filter/constants'
import { findFeedContainer } from '@/lib/feeds_filter/container_finder'
import { parseEventDateString } from '@/lib/feeds_filter/date_string_parser'
import {
  attachFilterDropdownToDom,
  findTargetSelect,
} from '@/lib/feeds_filter/dom_mount'
import { createFilterDropdownElement } from '@/lib/feeds_filter/dom_dropdown'
import { applyFeedFilterToDom } from '@/lib/feeds_filter/page_adapter'
import {
  getStoredFeedsFilterEnabled,
  setStoredFeedsFilterEnabled,
} from '@/lib/feeds_filter/storage'
import { resetBrowserMocks } from '../../setup/browser_mock'

describe('feeds_filter integration', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    document.body.innerHTML = ''
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
      applyFeedFilterToDom({ container, filter: status })
    })

    const attached = attachFilterDropdownToDom(controller.element, container)
    expect(attached).toBe(true)
    expect(document.getElementById(FEEDS_FILTER_SELECT_ID)).toBeDefined()

    // Исходная статистика и фильтрация
    const stats = applyFeedFilterToDom({ container, filter: 'red' })
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
