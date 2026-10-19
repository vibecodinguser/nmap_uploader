// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import { useFeedsFilter } from '@/hooks/useFeedsFilter'
import {
  applyFeedFilter,
  attachFilterDropdownToDom,
  createFeedDailyLoader,
  createFilterDropdownElement,
  FEED_HIDDEN_CLASS,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  findFeedContainer,
  findFeedHeader,
  findFeedScrollableContainer,
  findTargetSelect,
  getAllScrollableContainers,
  getCommitStateStatus,
  getEventCardDateText,
  getEventCardDayAge,
  getEventCardStatus,
  getLastCardWithDate,
  getLastCardWithDayAge,
  getStoredFeedsFilterEnabled,
  getTargetThresholdMs,
  isEditsModeSelected,
  isValidTargetSelect,
  parseEventCardDate,
  parseEventDateString,
  setStoredFeedsFilterEnabled,
  syncFilterDropdownHeight,
  triggerFeedScrollLoad,
} from '@/lib/user_feeds_filter'
import { resetBrowserMocks } from '../setup/browser_mock'

describe('user_feeds_filter', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    document.body.innerHTML = ''
  })

  describe('getCommitStateStatus', () => {
    it('определяет статус "red" для class="nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-commit-state-view_not-last nk-event-view__commit-state"', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-commit-state-view_not-last nk-event-view__commit-state"></span>
      `

      expect(getCommitStateStatus(card)).toBe('red')
      expect(getEventCardStatus(card)).toBe('red')
    })

    it('определяет статус "published" для иконки commit-published', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-published nk-commit-state-view nk-event-view__commit-state"></span>
      `

      expect(getCommitStateStatus(card)).toBe('published')
      expect(getEventCardStatus(card)).toBe('published')
    })

    it('определяет статус "green" для иконки commit-accepted / commit-approved', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-accepted nk-commit-state-view nk-event-view__commit-state"></span>
      `

      expect(getCommitStateStatus(card)).toBe('green')
      expect(getEventCardStatus(card)).toBe('green')
    })

    it('определяет статус "yellow" для иконки commit-pending / commit-moderation', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-pending nk-commit-state-view nk-event-view__commit-state"></span>
      `

      expect(getCommitStateStatus(card)).toBe('yellow')
      expect(getEventCardStatus(card)).toBe('yellow')
    })

    it('определяет статус по вложенной иконке внутри nk-event-view__commit-state', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <div class="nk-commit-state-view nk-event-view__commit-state">
          <span class="nk-icon nk-icon_id_commit-rejected"></span>
        </div>
      `

      expect(getCommitStateStatus(card)).toBe('red')
    })

    it('определяет статус по title или aria-label элемента состояния', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-commit-state-view nk-event-view__commit-state" title="Отклонено модератором"></span>
      `

      expect(getCommitStateStatus(card)).toBe('red')
    })

    it('возвращает null, если элемент состояния коммита отсутствует', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      expect(getCommitStateStatus(card)).toBeNull()
    })
  })

  describe('getEventCardStatus', () => {
    it('отдает приоритет состоянию коммита над текстом бейджа при их наличии', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-commit-state-view_not-last nk-event-view__commit-state"></span>
        <span class="nk-badge nk-badge_color_green nk-event-view__badge">Принята</span>
      `

      // Состояние коммита имеет высший приоритет
      expect(getEventCardStatus(card)).toBe('red')
    })

    it('определяет статус "green" по классу nk-badge_color_green', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML =
        '<span class="nk-badge nk-badge_color_green nk-event-view__badge">Принята</span>'

      expect(getEventCardStatus(card)).toBe('green')
    })

    it('определяет статус "yellow" по классу nk-badge_color_yellow', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML =
        '<span class="nk-badge nk-badge_color_yellow nk-event-view__badge">На проверке</span>'

      expect(getEventCardStatus(card)).toBe('yellow')
    })

    it('определяет статус "red" по классу nk-badge_color_red', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML =
        '<span class="nk-badge nk-badge_color_red nk-event-view__badge">Отклонена</span>'

      expect(getEventCardStatus(card)).toBe('red')
    })

    it('определяет статус по тексту бейджа при отсутствии цветового класса', () => {
      const cardGreen = document.createElement('div')
      cardGreen.innerHTML = '<span class="nk-badge nk-event-view__badge">Одобрено</span>'
      expect(getEventCardStatus(cardGreen)).toBe('green')

      const cardYellow = document.createElement('div')
      cardYellow.innerHTML = '<span class="nk-badge nk-event-view__badge">Ожидает модерации</span>'
      expect(getEventCardStatus(cardYellow)).toBe('yellow')

      const cardRed = document.createElement('div')
      cardRed.innerHTML = '<span class="nk-badge nk-event-view__badge">Отклонено модератором</span>'
      expect(getEventCardStatus(cardRed)).toBe('red')
    })

    it('возвращает "other", если бейдж отсутствует или статус неизвестен', () => {
      const cardWithoutBadge = document.createElement('div')
      expect(getEventCardStatus(cardWithoutBadge)).toBe('other')

      const cardUnknown = document.createElement('div')
      cardUnknown.innerHTML = '<span class="nk-badge nk-event-view__badge">Неизвестно</span>'
      expect(getEventCardStatus(cardUnknown)).toBe('other')
    })
  })

  describe('applyFeedFilter', () => {
    it('корректно фильтрует элементы и считает статистику', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div class="nk-event-view"><span class="nk-icon nk-icon_id_commit-published nk-commit-state-view nk-event-view__commit-state">Правка 1</span></div>
        <div class="nk-event-view"><span class="nk-badge nk-badge_color_green nk-event-view__badge">Правка 2</span></div>
        <div class="nk-event-view"><span class="nk-badge nk-badge_color_yellow nk-event-view__badge">Правка 3</span></div>
        <div class="nk-event-view"><span class="nk-badge nk-badge_color_red nk-event-view__badge">Правка 4</span></div>
      `

      // Фильтр 'red' (Не принята)
      const stats = applyFeedFilter(container, 'red')

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
      applyFeedFilter(container, 'published')
      expect(cards[0].classList.contains(FEED_HIDDEN_CLASS)).toBe(false)
      expect(cards[1].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
      expect(cards[2].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
      expect(cards[3].classList.contains(FEED_HIDDEN_CLASS)).toBe(true)

      // Сброс на 'all'
      applyFeedFilter(container, 'all')
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

  describe('isEditsModeSelected', () => {
    it('возвращает true, если в целевом селекте содержится спан с текстом "Правки"', () => {
      const select = document.createElement('div')
      select.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      const button = document.createElement('button')
      button.className = 'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
      const textSpan = document.createElement('span')
      textSpan.className = 'nk-button__text'
      textSpan.textContent = 'Правки'
      button.appendChild(textSpan)
      select.appendChild(button)

      expect(isEditsModeSelected(select)).toBe(true)
    })

    it('возвращает true для вариантов регистра и английского названия "Edits"', () => {
      const select1 = document.createElement('div')
      select1.innerHTML = '<span class="nk-button__text">  все правки  </span>'
      expect(isEditsModeSelected(select1)).toBe(true)

      const select2 = document.createElement('div')
      select2.innerHTML = '<span class="nk-button__text">Edits</span>'
      expect(isEditsModeSelected(select2)).toBe(true)
    })

    it('возвращает false, если выбран другой режим ("Комментарии", "Ошибки", "События")', () => {
      const selectComments = document.createElement('div')
      selectComments.innerHTML = '<span class="nk-button__text">Комментарии</span>'
      expect(isEditsModeSelected(selectComments)).toBe(false)

      const selectErrors = document.createElement('div')
      selectErrors.innerHTML = '<span class="nk-button__text">Ошибки</span>'
      expect(isEditsModeSelected(selectErrors)).toBe(false)

      const selectEvents = document.createElement('div')
      selectEvents.innerHTML = '<span class="nk-button__text">Все события</span>'
      expect(isEditsModeSelected(selectEvents)).toBe(false)
    })

    it('возвращает false для собственного элемента фильтра расширения', () => {
      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID
      mySelect.className = 'nmap-feeds-status-select'
      mySelect.innerHTML = '<span class="nk-button__text">Правки</span>'
      expect(isEditsModeSelected(mySelect)).toBe(false)
    })

    it('возвращает false для null, undefined или элементов без текста', () => {
      expect(isEditsModeSelected(null)).toBe(false)
      expect(isEditsModeSelected(undefined)).toBe(false)

      const emptySelect = document.createElement('div')
      expect(isEditsModeSelected(emptySelect)).toBe(false)
    })
  })

  describe('attachFilterDropdownToDom', () => {
    it('вставляет дропдаун фильтра сразу после целевого nk-select, если в нем выбран пункт "Правки"', () => {
      const container = document.createElement('div')
      const targetSelect = document.createElement('span')
      targetSelect.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      const targetButton = document.createElement('button')
      targetButton.className =
        'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
      targetButton.style.height = '32px'
      const textSpan = document.createElement('span')
      textSpan.className = 'nk-button__text'
      textSpan.textContent = 'Правки'
      targetButton.appendChild(textSpan)
      targetSelect.appendChild(targetButton)
      container.appendChild(targetSelect)

      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID
      const myButton = document.createElement('button')
      myButton.className = 'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
      mySelect.appendChild(myButton)

      const attached = attachFilterDropdownToDom(mySelect, container)
      expect(attached).toBe(true)
      expect(targetSelect.nextElementSibling).toBe(mySelect)
      expect(mySelect.style.getPropertyValue('--nmap-feeds-select-height')).toBe('32px')
      expect(myButton.style.height).toBe('32px')
      expect(mySelect.style.display).toBe('')
    })

    it('не отображает дропдаун и скрывает его, если в целевом селекте выбран другой пункт (например, "Комментарии")', () => {
      const container = document.createElement('div')
      const targetSelect = document.createElement('span')
      targetSelect.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      const targetButton = document.createElement('button')
      targetButton.className =
        'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
      const textSpan = document.createElement('span')
      textSpan.className = 'nk-button__text'
      textSpan.textContent = 'Комментарии'
      targetButton.appendChild(textSpan)
      targetSelect.appendChild(targetButton)
      container.appendChild(targetSelect)

      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID
      container.appendChild(mySelect)

      const attached = attachFilterDropdownToDom(mySelect, container)
      expect(attached).toBe(false)
      expect(mySelect.style.display).toBe('none')
    })

    it('не вставляет дропдаун и возвращает false, если целевой селект еще не отрендерен', () => {
      const container = document.createElement('div')
      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID

      const attached = attachFilterDropdownToDom(mySelect, container)
      expect(attached).toBe(false)
      expect(container.contains(mySelect)).toBe(false)
    })

    it('не выбрасывает HierarchyRequestError, если targetSelect совпадает с dropdownElement или содержит его', () => {
      const container = document.createElement('div')
      const controller = createFilterDropdownElement(() => {})
      container.appendChild(controller.element)

      expect(() => {
        const attached = attachFilterDropdownToDom(controller.element, container)
        expect(attached).toBe(false)
      }).not.toThrow()

      controller.teardown()
    })
  })

  describe('findFeedHeader', () => {
    it('находит шапку .nk-user-feeds-view__header внутри контейнера', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'
      const header = document.createElement('div')
      header.className = 'nk-user-feeds-view__header'
      container.appendChild(header)

      expect(findFeedHeader(container)).toBe(header)
    })

    it('находит шапку в документе, если контейнер не передан', () => {
      const header = document.createElement('div')
      header.className = 'nk-user-feeds-view__header'
      document.body.appendChild(header)

      expect(findFeedHeader()).toBe(header)
    })
  })

  describe('syncFilterDropdownHeight', () => {
    it('копирует высоту из целевого селекта (например, 32px)', () => {
      const targetSelect = document.createElement('span')
      targetSelect.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      const targetButton = document.createElement('button')
      targetButton.className =
        'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
      targetButton.style.height = '36px'
      targetSelect.appendChild(targetButton)
      document.body.appendChild(targetSelect)

      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID
      const myButton = document.createElement('button')
      myButton.className = 'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
      mySelect.appendChild(myButton)

      const height = syncFilterDropdownHeight(mySelect, targetSelect)
      expect(height).toBe(36)
      expect(mySelect.style.getPropertyValue('--nmap-feeds-select-height')).toBe('36px')
      expect(myButton.style.height).toBe('36px')
    })

    it('использует дефолт 32px для size_m, если целевой селект не имеет явной высоты', () => {
      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID
      const myButton = document.createElement('button')
      myButton.className = 'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
      mySelect.appendChild(myButton)

      const height = syncFilterDropdownHeight(mySelect, null)
      expect(height).toBe(32)
      expect(mySelect.style.getPropertyValue('--nmap-feeds-select-height')).toBe('32px')
      expect(myButton.style.height).toBe('32px')
    })

    it('контроллер предоставляет работающий метод syncHeight', () => {
      const controller = createFilterDropdownElement(() => {})
      const height = controller.syncHeight()
      expect(height).toBe(32)
      expect(controller.element.style.getPropertyValue('--nmap-feeds-select-height')).toBe('32px')
      controller.teardown()
    })
  })

  describe('findTargetSelect', () => {
    it('находит nk-select_size_m в контейнере', () => {
      const container = document.createElement('div')
      const target = document.createElement('span')
      target.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      container.appendChild(target)

      expect(findTargetSelect(container)).toBe(target)
    })

    it('находит nk-select без класса theme_islands', () => {
      const container = document.createElement('div')
      const target = document.createElement('span')
      target.className = 'nk-select nk-select_size_m'
      container.appendChild(target)

      expect(findTargetSelect(container)).toBe(target)
    })

    it('находит селект внутри шапки nk-user-feeds-view__header', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'
      const header = document.createElement('div')
      header.className = 'nk-user-feeds-view__header'
      const target = document.createElement('span')
      target.className = 'nk-select'
      header.appendChild(target)
      container.appendChild(header)

      expect(findTargetSelect(container)).toBe(target)
    })

    it('игнорирует собственный селект nmap-feeds-filter-select', () => {
      const container = document.createElement('div')
      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID
      mySelect.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      container.appendChild(mySelect)

      expect(findTargetSelect(container)).toBeNull()
    })

    it('игнорирует внутренние кнопки nk-select__button и элементы внутри своего дропдауна', () => {
      const container = document.createElement('div')
      const controller = createFilterDropdownElement(() => {})
      container.appendChild(controller.element)

      // findTargetSelect не должен возвращать внутреннюю кнопку дропдауна
      expect(findTargetSelect(container)).toBeNull()
      expect(findTargetSelect(container, controller.element)).toBeNull()

      controller.teardown()
    })

    it('игнорирует элементы внутри кнопок тулбара редактора', () => {
      const container = document.createElement('div')
      const toolbarButton = document.createElement('button')
      toolbarButton.className = 'nk-user-feeds-control-view'
      const innerSelect = document.createElement('span')
      innerSelect.className = 'nk-select'
      toolbarButton.appendChild(innerSelect)
      container.appendChild(toolbarButton)

      expect(findTargetSelect(container)).toBeNull()
    })

    it('находит целевой селект внутри nk-sidebar-view, когда в нем открыта лента событий', () => {
      const sidebar = document.createElement('div')
      sidebar.className = 'nk-sidebar-view'
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      sidebar.appendChild(card)

      const target = document.createElement('span')
      target.className = 'nk-select nk-select_size_m'
      sidebar.appendChild(target)
      document.body.appendChild(sidebar)

      expect(findTargetSelect(sidebar)).toBe(target)
    })
  })

  describe('isValidTargetSelect', () => {
    it('возвращает false для null, undefined и не-элементов', () => {
      expect(isValidTargetSelect(null)).toBe(false)
      expect(isValidTargetSelect(undefined as unknown as Element)).toBe(false)
    })

    it('отклоняет свой собственный селект и его дочерние узлы', () => {
      const controller = createFilterDropdownElement(() => {})
      expect(isValidTargetSelect(controller.element)).toBe(false)

      const innerButton = controller.element.querySelector('button')
      expect(isValidTargetSelect(innerButton)).toBe(false)

      controller.teardown()
    })

    it('отклоняет БЭМ-элементы вида nk-select__button и nk-select__text', () => {
      const button = document.createElement('button')
      button.className = 'nk-select__button'
      expect(isValidTargetSelect(button)).toBe(false)

      const text = document.createElement('span')
      text.className = 'nk-select__text'
      expect(isValidTargetSelect(text)).toBe(false)
    })

    it('принимает корректный корневой элемент .nk-select', () => {
      const select = document.createElement('span')
      select.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      expect(isValidTargetSelect(select)).toBe(true)
    })
  })

  describe('findFeedContainer', () => {
    it('находит родительский контейнер по наличию карточек событий', () => {
      const parent = document.createElement('div')
      parent.className = 'nk-user-feeds-view'
      parent.innerHTML = '<div class="nk-event-view">Event</div>'
      document.body.appendChild(parent)

      expect(findFeedContainer(document.body)).toBe(parent)
    })

    it('находит контейнер по селектору [class*="user-feeds-view"]', () => {
      const parent = document.createElement('div')
      parent.className = 'custom-user-feeds-view'
      document.body.appendChild(parent)

      expect(findFeedContainer(document.body)).toBe(parent)
    })

    it('игнорирует элементы кнопок тулбара с классом control-view', () => {
      const button = document.createElement('div')
      button.className = 'nk-user-feeds-control-view'
      document.body.appendChild(button)

      expect(findFeedContainer(document.body)).toBeNull()
    })

    it('находит сайдбар nk-sidebar-view, если в нем открыта лента событий', () => {
      const sidebar = document.createElement('div')
      sidebar.className = 'nk-sidebar-view'
      sidebar.innerHTML = '<div class="nk-event-view">Event</div>'
      document.body.appendChild(sidebar)

      expect(findFeedContainer(document.body)).toBe(sidebar)
    })
  })

  describe('хранилище настроек и хук useFeedsFilter', () => {
    it('по умолчанию возвращает false при отсутствии значения в хранилище', async () => {
      const enabled = await getStoredFeedsFilterEnabled()
      expect(enabled).toBe(false)
    })

    it('сохраняет и читает значение настройки', async () => {
      await setStoredFeedsFilterEnabled(false)
      expect(await getStoredFeedsFilterEnabled()).toBe(false)

      await setStoredFeedsFilterEnabled(true)
      expect(await getStoredFeedsFilterEnabled()).toBe(true)
    })

    it('корректно читает значение, установленное напрямую в storage', async () => {
      await browser.storage.local.set({ [FEEDS_FILTER_ENABLED_STORAGE_KEY]: true })
      expect(await getStoredFeedsFilterEnabled()).toBe(true)
    })

    it('хук useFeedsFilter инициализируется и сохраняет новое состояние', async () => {
      const { result } = renderHook(() => useFeedsFilter())

      await act(async () => {
        // ждём чтения из хранилища
      })

      expect(result.current.isEnabled).toBe(false)
      expect(result.current.isLoaded).toBe(true)

      await act(async () => {
        result.current.setIsEnabled(true)
      })

      expect(result.current.isEnabled).toBe(true)
      expect(await getStoredFeedsFilterEnabled()).toBe(true)
    })
  })

  describe('parseEventDateString', () => {
    const fixedNow = new Date('2026-10-15T15:30:00.000Z').getTime()

    it('корректно парсит "только что"', () => {
      const parsed = parseEventDateString('только что', fixedNow)
      expect(parsed?.getTime()).toBe(fixedNow)
    })

    it('корректно парсит относительное время (минуты, часы, дни)', () => {
      const parsedMin = parseEventDateString('15 минут назад', fixedNow)
      expect(parsedMin?.getTime()).toBe(fixedNow - 15 * 60 * 1000)

      const parsedHours = parseEventDateString('3 часа назад', fixedNow)
      expect(parsedHours?.getTime()).toBe(fixedNow - 3 * 3600 * 1000)

      const parsedDays = parseEventDateString('2 дня назад', fixedNow)
      expect(parsedDays?.getTime()).toBe(fixedNow - 2 * 86400 * 1000)
    })

    it('корректно парсит "сегодня в 14:20"', () => {
      const parsed = parseEventDateString('сегодня в 14:20', fixedNow)
      expect(parsed).not.toBeNull()
      expect(parsed?.getHours()).toBe(14)
      expect(parsed?.getMinutes()).toBe(20)
    })

    it('корректно парсит "вчера в 18:00"', () => {
      const parsed = parseEventDateString('вчера в 18:00', fixedNow)
      expect(parsed).not.toBeNull()
      expect(parsed?.getHours()).toBe(18)
      expect(parsed?.getMinutes()).toBe(0)
      const diffHours = (fixedNow - (parsed?.getTime() || 0)) / 3600000
      expect(diffHours).toBeGreaterThan(15)
    })

    it('корректно парсит "позавчера в 10:00"', () => {
      const parsed = parseEventDateString('позавчера в 10:00', fixedNow)
      expect(parsed).not.toBeNull()
      expect(parsed?.getHours()).toBe(10)
      const diffDays = (fixedNow - (parsed?.getTime() || 0)) / 86400000
      expect(diffDays).toBeGreaterThanOrEqual(1.8)
    })

    it('корректно парсит даты с названиями месяцев и числовые форматы', () => {
      const parsedMonth = parseEventDateString('12 октября 2026 в 11:45', fixedNow)
      expect(parsedMonth?.getDate()).toBe(12)
      expect(parsedMonth?.getMonth()).toBe(9) // октябрь (0-indexed = 9)
      expect(parsedMonth?.getFullYear()).toBe(2026)
      expect(parsedMonth?.getHours()).toBe(11)
      expect(parsedMonth?.getMinutes()).toBe(45)

      const parsedNumeric = parseEventDateString('10.10.2026 09:15', fixedNow)
      expect(parsedNumeric?.getDate()).toBe(10)
      expect(parsedNumeric?.getMonth()).toBe(9)
      expect(parsedNumeric?.getFullYear()).toBe(2026)
    })

    it('парсит изолированное время без слова "сегодня" как сегодняшнее', () => {
      const parsedTime = parseEventDateString('14:20', fixedNow)
      expect(parsedTime).not.toBeNull()
      expect(parsedTime?.getHours()).toBe(14)
      expect(parsedTime?.getMinutes()).toBe(20)

      const parsedWithV = parseEventDateString('в 09:05', fixedNow)
      expect(parsedWithV).not.toBeNull()
      expect(parsedWithV?.getHours()).toBe(9)
      expect(parsedWithV?.getMinutes()).toBe(5)
    })

    it('не считает названия улиц и адреса датами (ул. 8 Марта, пер. 1 Мая)', () => {
      expect(parseEventDateString('ул. 8 Марта, 12')).toBeNull()
      expect(parseEventDateString('переулок 1 Мая, 5')).toBeNull()
      expect(parseEventDateString('проспект 60 лет Октября')).toBeNull()
    })

    it('возвращает null для некорректных или пустых строк', () => {
      expect(parseEventDateString('')).toBeNull()
      expect(parseEventDateString('какой-то текст без даты')).toBeNull()
    })
  })

  describe('parseEventCardDate', () => {
    const fixedNow = new Date('2026-10-15T15:30:00.000Z').getTime()

    it('извлекает дату из атрибута data-timestamp (в мс или секундах)', () => {
      const cardMs = document.createElement('div')
      cardMs.className = 'nk-event-view'
      cardMs.setAttribute('data-timestamp', String(fixedNow))
      expect(parseEventCardDate(cardMs)?.getTime()).toBe(fixedNow)

      const cardSec = document.createElement('div')
      cardSec.className = 'nk-event-view'
      cardSec.setAttribute('data-timestamp', String(Math.floor(fixedNow / 1000)))
      expect(parseEventCardDate(cardSec)?.getTime()).toBe(Math.floor(fixedNow / 1000) * 1000)
    })

    it('извлекает дату из тега <time datetime="...">', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = '<time datetime="2026-10-15T10:00:00Z">15 октября</time>'
      const parsed = parseEventCardDate(card, fixedNow)
      expect(parsed?.toISOString()).toBe('2026-10-15T10:00:00.000Z')
    })

    it('извлекает дату из элемента .nk-event-view__time', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = '<span class="nk-event-view__time">5 минут назад</span>'
      const parsed = parseEventCardDate(card, fixedNow)
      expect(parsed?.getTime()).toBe(fixedNow - 5 * 60 * 1000)
    })

    it('не сбивается на название улицы в заголовке события', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <div class="nk-event-view__header">Здание: ул. 8 Марта, 15</div>
        <div class="nk-event-view__time">14:20</div>
      `
      const parsed = parseEventCardDate(card, fixedNow)
      expect(parsed?.getHours()).toBe(14)
      expect(parsed?.getMinutes()).toBe(20)
    })

    it('извлекает дату из текстового содержимого карточки при отсутствии спец-элементов', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.textContent = 'Пользователь обновил здание сегодня в 12:00'
      const parsed = parseEventCardDate(card, fixedNow)
      expect(parsed?.getHours()).toBe(12)
    })
  })

  describe('getTargetThresholdMs', () => {
    it('рассчитывает порог для 1 суток так, чтобы покрывать весь сегодняшний день с 00:00 и 24 часа', () => {
      // 15 октября 2026 21:30
      const ref = new Date('2026-10-15T21:30:00.000Z').getTime()
      const threshold = getTargetThresholdMs(1, ref)

      // Должно быть не позже 24 часов назад (14 октября 21:30) и начала сегодня (15 октября 00:00)
      const twentyFourHoursAgo = ref - 24 * 3600 * 1000
      expect(threshold).toBe(twentyFourHoursAgo)
      expect(threshold).toBeLessThan(new Date('2026-10-15T00:00:00.000Z').getTime())
    })

    it('для утреннего времени рассчитывает порог не позже 24 часов назад', () => {
      // 15 октября 2026 05:00
      const ref = new Date('2026-10-15T05:00:00.000Z').getTime()
      const threshold = getTargetThresholdMs(1, ref)
      const twentyFourHoursAgo = ref - 24 * 3600 * 1000
      expect(threshold).toBe(twentyFourHoursAgo)
    })
  })

  describe('getEventCardDayAge and getEventCardDateText', () => {
    it('извлекает текст даты из .nk-date-time.nk-event-view__date', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-date-time nk-date-time_mode_relative nk-event-view__date">вчера, 18:32</span>
      `
      expect(getEventCardDateText(card)).toBe('вчера, 18:32')
      expect(getEventCardDayAge(card)).toBe(1)
    })

    it('определяет давность 0 дней для событий за сегодня ("только что", минуты, часы назад, "сегодня", "HH:MM")', () => {
      const makeCard = (text: string) => {
        const card = document.createElement('div')
        card.className = 'nk-event-view'
        card.innerHTML = `<span class="nk-date-time nk-event-view__date">${text}</span>`
        return card
      }

      expect(getEventCardDayAge(makeCard('только что'))).toBe(0)
      expect(getEventCardDayAge(makeCard('15 минут назад'))).toBe(0)
      expect(getEventCardDayAge(makeCard('3 часа назад'))).toBe(0)
      expect(getEventCardDayAge(makeCard('сегодня, 14:20'))).toBe(0)
      expect(getEventCardDayAge(makeCard('14:20'))).toBe(0)
      expect(getEventCardDayAge(makeCard('в 09:05'))).toBe(0)
    })

    it('определяет давность 1 день для "вчера, хх:хх"', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `<span class="nk-date-time nk-event-view__date">вчера, 21:15</span>`
      expect(getEventCardDayAge(card)).toBe(1)
    })

    it('определяет давность 2 дня для "позавчера" и "2 дня назад"', () => {
      const cardPozavchera = document.createElement('div')
      cardPozavchera.innerHTML = `<span class="nk-date-time nk-event-view__date">позавчера, 10:00</span>`
      expect(getEventCardDayAge(cardPozavchera)).toBe(2)

      const card2Days = document.createElement('div')
      card2Days.innerHTML = `<span class="nk-date-time nk-event-view__date">2 дня назад</span>`
      expect(getEventCardDayAge(card2Days)).toBe(2)
    })

    it('определяет давность N дней для "N дня/дней назад"', () => {
      const card3Days = document.createElement('div')
      card3Days.innerHTML = `<span class="nk-date-time nk-event-view__date">3 дня назад</span>`
      expect(getEventCardDayAge(card3Days)).toBe(3)

      const card10Days = document.createElement('div')
      card10Days.innerHTML = `<span class="nk-date-time nk-event-view__date">10 дней назад</span>`
      expect(getEventCardDayAge(card10Days)).toBe(10)
    })
  })

  describe('getLastCardWithDayAge and getLastCardWithDate', () => {
    it('находит последнюю карточку с валидной давностью, игнорируя скелетоны', () => {
      const fixedNow = new Date('2026-10-15T15:30:00.000Z').getTime()

      const card1 = document.createElement('div')
      card1.className = 'nk-event-view'
      card1.innerHTML = '<span class="nk-date-time nk-event-view__date">сегодня, 12:00</span>'

      const skeletonCard = document.createElement('div')
      skeletonCard.className = 'nk-event-view nk-event-view_skeleton'

      const result = getLastCardWithDayAge([card1, skeletonCard], fixedNow)
      expect(result).not.toBeNull()
      expect(result?.card).toBe(card1)
      expect(result?.dayAge).toBe(0)

      const dateResult = getLastCardWithDate([card1, skeletonCard], fixedNow)
      expect(dateResult).not.toBeNull()
      expect(dateResult?.card).toBe(card1)
    })
  })

  describe('findFeedScrollableContainer, getAllScrollableContainers and triggerFeedScrollLoad', () => {
    it('находит все потенциально скроллируемые контейнеры и находит скролл', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'
      const innerScroll = document.createElement('div')
      innerScroll.className = 'nk-scrollable__content'
      container.appendChild(innerScroll)

      const all = getAllScrollableContainers(container)
      expect(all.length).toBeGreaterThan(0)
      expect(all).toContain(innerScroll)

      const scrollable = findFeedScrollableContainer(container)
      expect(scrollable).toBe(innerScroll)
    })

    it('прокручивает контейнеры и диспатчит событие scroll', () => {
      const container = document.createElement('div')
      let scrollFired = false
      container.addEventListener('scroll', () => {
        scrollFired = true
      })
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })

      triggerFeedScrollLoad(container)
      expect(container.scrollTop).toBe(1000)
      expect(scrollFired).toBe(true)
    })

    it('нажимает кнопку "Показать еще" при ее наличии', () => {
      const container = document.createElement('div')
      const moreBtn = document.createElement('button')
      moreBtn.className = 'nk-button'
      moreBtn.textContent = 'Показать еще'
      let clicked = false
      moreBtn.addEventListener('click', () => {
        clicked = true
      })
      container.appendChild(moreBtn)

      triggerFeedScrollLoad(container)
      expect(clicked).toBe(true)
    })
  })

  describe('createFeedDailyLoader', () => {
    it('создает контроллер суточной пагинации и сразу завершает работу, если карточки уже старше 24 часов', async () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'

      // Создаем карточку старше 24 часов (вчера)
      const oldCard = document.createElement('div')
      oldCard.className = 'nk-event-view'
      oldCard.innerHTML = '<span class="nk-date-time nk-event-view__date">вчера, 18:00</span>'
      container.appendChild(oldCard)

      const loader = createFeedDailyLoader(container, { maxStepsPerDay: 5, stepDelayMs: 0 })

      await act(async () => {
        await new Promise((res) => setTimeout(res, 20))
      })

      expect(loader.isLoading()).toBe(false)
      expect(loader.getLoadedDaysCount()).toBe(1)
      loader.teardown()
    })

    it('начинает дозагрузку, если последняя карточка относится к сегодняшнему дню', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'

      const recentCard = document.createElement('div')
      recentCard.className = 'nk-event-view'
      recentCard.innerHTML = '<span class="nk-date-time nk-event-view__date">1 час назад</span>'
      container.appendChild(recentCard)

      const loader = createFeedDailyLoader(container, { maxStepsPerDay: 5, stepDelayMs: 50 })
      expect(loader.isLoading()).toBe(true)
      loader.teardown()
    })

    it('корректно очищает слушатели и останавливает загрузку при вызове teardown', async () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'
      document.body.appendChild(container)

      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = '<span class="nk-date-time nk-event-view__date">вчера, 10:00</span>'
      container.appendChild(card)

      const loader = createFeedDailyLoader(container, { stepDelayMs: 0 })

      loader.teardown()
      expect(loader.isLoading()).toBe(false)
    })
  })
})
