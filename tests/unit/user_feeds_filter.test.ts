// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import { useFeedsFilter } from '@/hooks/useFeedsFilter'
import {
  applyFeedFilter,
  attachFilterDropdownToDom,
  createFilterDropdownElement,
  FEED_HIDDEN_CLASS,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  findFeedContainer,
  findTargetSelect,
  getCommitStateStatus,
  getEventCardStatus,
  getStoredFeedsFilterEnabled,
  setStoredFeedsFilterEnabled,
  syncFilterDropdownHeight,
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

      // Фильтр 'red' (Отклоненные)
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

      // Фильтр 'published' (Правка опубликована)
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

      // Клик по пункту меню "Правка опубликована" (published)
      publishedItem?.click()
      expect(selectedStatus).toBe('published')
      expect(controller.popupElement.style.display).toBe('none')
      expect(buttonIcon?.style.display).toBe('inline-flex')
      expect(buttonIcon?.querySelector('svg')).toBeDefined()
      expect(buttonIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-published nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )

      // Клик по пункту меню "Принятые" (green)
      controller.setActiveFilter('green')
      expect(buttonIcon?.style.display).toBe('inline-flex')
      expect(buttonIcon?.querySelector('svg')).toBeDefined()
      expect(buttonIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-approved nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )

      // Переключение на "На проверке" (yellow)
      controller.setActiveFilter('yellow')
      expect(buttonIcon?.style.display).toBe('inline-flex')
      expect(buttonIcon?.querySelector('svg')).toBeDefined()
      expect(buttonIcon?.className).toBe(
        'nk-icon nk-icon_id_commit-pending nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
      )

      // Переключение на "Отклоненные" (red)
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

  describe('attachFilterDropdownToDom', () => {
    it('вставляет дропдаун фильтра сразу после целевого nk-select и синхронизирует высоту', () => {
      const container = document.createElement('div')
      const targetSelect = document.createElement('span')
      targetSelect.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      const targetButton = document.createElement('button')
      targetButton.className =
        'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
      targetButton.style.height = '32px'
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
    })

    it('вставляет дропдаун в начало контейнера, если целевой селект еще не появился', () => {
      const container = document.createElement('div')
      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID

      const attached = attachFilterDropdownToDom(mySelect, container)
      expect(attached).toBe(false)
      expect(container.firstElementChild).toBe(mySelect)
      expect(mySelect.style.getPropertyValue('--nmap-feeds-select-height')).toBe('32px')
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

    it('игнорирует собственный селект nmap-feeds-filter-select', () => {
      const container = document.createElement('div')
      const mySelect = document.createElement('span')
      mySelect.id = FEEDS_FILTER_SELECT_ID
      mySelect.className = 'nk-select nk-select_theme_islands nk-select_size_m'
      container.appendChild(mySelect)

      expect(findTargetSelect(container)).toBeNull()
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
  })

  describe('хранилище настроек и хук useFeedsFilter', () => {
    it('по умолчанию возвращает true при отсутствии значения в хранилище', async () => {
      const enabled = await getStoredFeedsFilterEnabled()
      expect(enabled).toBe(true)
    })

    it('сохраняет и читает значение настройки', async () => {
      await setStoredFeedsFilterEnabled(false)
      expect(await getStoredFeedsFilterEnabled()).toBe(false)

      await setStoredFeedsFilterEnabled(true)
      expect(await getStoredFeedsFilterEnabled()).toBe(true)
    })

    it('корректно читает значение, установленное напрямую в storage', async () => {
      await browser.storage.local.set({ [FEEDS_FILTER_ENABLED_STORAGE_KEY]: false })
      expect(await getStoredFeedsFilterEnabled()).toBe(false)
    })

    it('хук useFeedsFilter инициализируется и сохраняет новое состояние', async () => {
      const { result } = renderHook(() => useFeedsFilter())

      await act(async () => {
        // ждём чтения из хранилища
      })

      expect(result.current.isEnabled).toBe(true)
      expect(result.current.isLoaded).toBe(true)

      await act(async () => {
        result.current.setIsEnabled(false)
      })

      expect(result.current.isEnabled).toBe(false)
      expect(await getStoredFeedsFilterEnabled()).toBe(false)
    })
  })
})
