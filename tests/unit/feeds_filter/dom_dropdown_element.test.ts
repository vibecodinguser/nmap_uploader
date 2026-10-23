// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  FEED_HIDDEN_CLASS,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
} from '@/lib/feeds_filter/constants'
import { createFilterDropdownElement } from '@/lib/feeds_filter/dom_dropdown'
import { applyFeedFilterToDom } from '@/lib/feeds_filter/page_adapter'

describe('feeds_filter applyFeedFilter and dom_dropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('applyFeedFilterToDom', () => {
    it('корректно фильтрует элементы и считает статистику', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div class="nk-event-view"><span class="nk-icon nk-icon_id_commit-published nk-commit-state-view nk-event-view__commit-state">Правка 1</span></div>
        <div class="nk-event-view"><span class="nk-badge nk-badge_color_green nk-event-view__badge">Правка 2</span></div>
        <div class="nk-event-view"><span class="nk-badge nk-badge_color_yellow nk-event-view__badge">Правка 3</span></div>
        <div class="nk-event-view"><span class="nk-badge nk-badge_color_red nk-event-view__badge">Правка 4</span></div>
      `

      // Фильтр 'red' (Не принята)
      const stats = applyFeedFilterToDom({ container, filter: 'red' })

      expect(stats.total).toBe(4)
      expect(stats.published).toBe(1)
      expect(stats.green).toBe(1)
      expect(stats.yellow).toBe(1)
      expect(stats.red).toBe(1)

      const cards = container.querySelectorAll('.nk-event-view')
      expect(cards[0].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
      expect(cards[1].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
      expect(cards[2].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
      expect(cards[3].classList.contains(FEED_HIDDEN_CLASS)).toBe(false)

      // Фильтр 'published' (Опубликована)
      applyFeedFilterToDom({ container, filter: 'published' })
      expect(cards[0].classList.contains(FEED_HIDDEN_CLASS)).toBe(false)
      expect(cards[1].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
      expect(cards[2].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
      expect(cards[3].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)

      // Сброс на 'all'
      applyFeedFilterToDom({ container, filter: 'all' })
      cards.forEach((card) => {
        expect(card.classList.contains(FEED_HIDDEN_CLASS)).toBe(false)
      })
    })
  })

  describe('createFilterDropdownElement', () => {
    it('создает селект дропдауна с правильной разметкой, иконками статусов и переключением', () => {
      let selectedStatus = 'all'
      const controller = createFilterDropdownElement((status) => {
        selectedStatus = status
      })

      expect(controller.element.id).toBe(FEEDS_FILTER_SELECT_ID)
      expect(controller.element.classList.contains('nk-select')).toBe(true)
      expect(controller.element.classList.contains('nk-select_theme_islands')).toBe(true)

      const button = controller.element.querySelector('button')
      expect(button).toBeDefined()

      // Проверяем наличие нативного элемента стрелки с классом nk-select__tick
      const tick = controller.element.querySelector('.nk-select__tick')
      expect(tick).not.toBeNull()
      expect(tick?.getAttribute('aria-hidden')).toBe('true')
      expect(controller.element.querySelector('.nk-select__arrow')).toBeNull()

      // Проверяем иконку в кнопке в исходном состоянии ('all' - скрыта)
      const buttonIcon = controller.element.querySelector<HTMLElement>('.nk-select__text .nk-icon')
      expect(buttonIcon).toBeDefined()
      expect(buttonIcon?.style.display).toBe('none')

      // Проверяем открытие/закрытие попапа по клику
      button?.click()
      expect(controller.popupElement.style.display).toBe('block')
      expect(controller.element.classList.contains('nk-select_opened')).toBe(true)

      // Проверяем иконки в элементах выпадающего меню
      const allItem = controller.popupElement.querySelector<HTMLElement>('[data-status="all"]')
      const publishedItem = controller.popupElement.querySelector<HTMLElement>(
        '[data-status="published"]',
      )
      const greenItem = controller.popupElement.querySelector<HTMLElement>('[data-status="green"]')
      const yellowItem =
        controller.popupElement.querySelector<HTMLElement>('[data-status="yellow"]')
      const redItem = controller.popupElement.querySelector<HTMLElement>('[data-status="red"]')

      expect(allItem?.querySelector('.nk-icon')).toBeNull()

      const publishedIcon = publishedItem?.querySelector('.nk-icon')
      expect(publishedIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-published nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )
      expect(publishedIcon?.querySelector('svg')).toBeDefined()

      const greenIcon = greenItem?.querySelector('.nk-icon')
      expect(greenIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-approved nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )
      expect(greenIcon?.querySelector('svg')).toBeDefined()

      const yellowIcon = yellowItem?.querySelector('.nk-icon')
      expect(yellowIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-pending nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )
      expect(yellowIcon?.querySelector('svg')).toBeDefined()

      const redIcon = redItem?.querySelector('.nk-icon')
      expect(redIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )
      expect(redIcon?.querySelector('svg')).toBeDefined()

      // Проверяем обновление счетчиков
      controller.updateCounters({ total: 20, published: 5, green: 10, yellow: 3, red: 2 })

      const publishedBadge = publishedItem?.querySelector('.nmap-status-count-badge')
      expect(publishedBadge?.textContent).toBe('5')

      const greenBadge = greenItem?.querySelector('.nmap-status-count-badge')
      expect(greenBadge?.textContent).toBe('10')

      // Клик по пункту меню "Опубликована" (published)
      publishedItem?.click()
      expect(selectedStatus).toBe('published')
      expect(controller.popupElement.style.display).toBe('none')
      expect(buttonIcon?.style.display).toBe('inline-flex')
      expect(buttonIcon?.querySelector('svg')).toBeDefined()
      expect(buttonIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-published nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )

      // Клик по пункту меню "Одобрена" (green)
      controller.setActiveFilter('green')
      expect(buttonIcon?.style.display).toBe('inline-flex')
      expect(buttonIcon?.querySelector('svg')).toBeDefined()
      expect(buttonIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-approved nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )

      // Переключение на "На рассмотрении" (yellow)
      controller.setActiveFilter('yellow')
      expect(buttonIcon?.style.display).toBe('inline-flex')
      expect(buttonIcon?.querySelector('svg')).toBeDefined()
      expect(buttonIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-pending nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )

      // Переключение на "Не принята" (red)
      controller.setActiveFilter('red')
      expect(buttonIcon?.style.display).toBe('inline-flex')
      expect(buttonIcon?.querySelector('svg')).toBeDefined()
      expect(buttonIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )

      // Переключение обратно на "Все статусы" (all)
      controller.setActiveFilter('all')
      expect(buttonIcon?.style.display).toBe('none')
      expect(buttonIcon?.querySelector('svg')).toBeNull()

      // Проверяем очистку
      controller.teardown()
      expect(document.getElementById(FEEDS_FILTER_POPUP_ID)).toBeNull()
    })
  })
})
