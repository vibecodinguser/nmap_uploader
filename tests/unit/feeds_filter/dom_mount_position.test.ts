// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  attachFilterDropdownToDom,
  createFilterDropdownElement,
  FEEDS_FILTER_SELECT_ID,
  findFeedContainer,
  findFeedHeader,
  findTargetSelect,
  isEditsModeSelected,
  syncFilterDropdownHeight,
} from '@/lib/user_feeds_filter'

describe('feeds_filter dom mount and positioning', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
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
})
