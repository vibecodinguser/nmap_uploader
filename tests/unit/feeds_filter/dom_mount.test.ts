// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  attachFilterDropdownToDom,
  findFeedContainer,
  findFeedHeader,
  findTargetSelect,
  isEditsModeSelected,
  isValidTargetSelect,
} from '@/lib/feeds_filter/dom_mount'

describe('feeds_filter/dom_mount', () => {
  describe('isValidTargetSelect', () => {
    it('возвращает true для стандартного nk-select', () => {
      const el = document.createElement('div')
      el.className = 'nk-select nk-select_size_m'
      expect(isValidTargetSelect(el)).toBe(true)
    })

    it('возвращает false для элементов внутри панели инструментов или кнопок', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-toolbar-view'
      const select = document.createElement('div')
      select.className = 'nk-select'
      toolbar.appendChild(select)
      expect(isValidTargetSelect(select)).toBe(false)
    })

    it('возвращает false для внутренних БЭМ-элементов nk-select__button', () => {
      const btn = document.createElement('button')
      btn.className = 'nk-select__button'
      expect(isValidTargetSelect(btn)).toBe(false)
    })
  })

  describe('isEditsModeSelected', () => {
    it('распознает выбор режима "Правки"', () => {
      const select = document.createElement('div')
      select.className = 'nk-select'
      const text = document.createElement('span')
      text.className = 'nk-button__text'
      text.textContent = 'Правки'
      select.appendChild(text)

      expect(isEditsModeSelected(select)).toBe(true)
    })

    it('возвращает false, если выбраны "Комментарии"', () => {
      const select = document.createElement('div')
      select.className = 'nk-select'
      const text = document.createElement('span')
      text.className = 'nk-button__text'
      text.textContent = 'Комментарии'
      select.appendChild(text)

      expect(isEditsModeSelected(select)).toBe(false)
    })
  })

  describe('findTargetSelect и findFeedHeader', () => {
    it('находит целевой селект в шапке ленты', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'

      const header = document.createElement('div')
      header.className = 'nk-user-feeds-view__header'

      const select = document.createElement('div')
      select.className = 'nk-select'
      const text = document.createElement('span')
      text.className = 'nk-button__text'
      text.textContent = 'Правки'
      select.appendChild(text)

      header.appendChild(select)
      container.appendChild(header)

      expect(findFeedHeader(container)).toBe(header)
      expect(findTargetSelect(container)).toBe(select)
    })
  })

  describe('attachFilterDropdownToDom', () => {
    it('монтирует дропдаун после целевого селекта при режиме "Правки"', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'

      const header = document.createElement('div')
      header.className = 'nk-user-feeds-view__header'

      const select = document.createElement('div')
      select.className = 'nk-select'
      const text = document.createElement('span')
      text.className = 'nk-button__text'
      text.textContent = 'Правки'
      select.appendChild(text)
      header.appendChild(select)
      container.appendChild(header)

      const dropdown = document.createElement('div')
      dropdown.id = 'nmap-feeds-status-select-container'

      const attached = attachFilterDropdownToDom(dropdown, container)
      expect(attached).toBe(true)
      expect(select.nextElementSibling).toBe(dropdown)
    })

    it('скрывает дропдаун и возвращает false, если режим не "Правки"', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'

      const header = document.createElement('div')
      header.className = 'nk-user-feeds-view__header'

      const select = document.createElement('div')
      select.className = 'nk-select'
      const text = document.createElement('span')
      text.className = 'nk-button__text'
      text.textContent = 'Ошибки'
      select.appendChild(text)
      header.appendChild(select)
      container.appendChild(header)

      const dropdown = document.createElement('div')
      dropdown.id = 'nmap-feeds-status-select-container'

      const attached = attachFilterDropdownToDom(dropdown, container)
      expect(attached).toBe(false)
    })
  })

  describe('findFeedContainer', () => {
    it('находит контейнер ленты по карточкам событий', () => {
      const root = document.createElement('div')
      const feedView = document.createElement('div')
      feedView.className = 'nk-user-feeds-view'
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      feedView.appendChild(card)
      root.appendChild(feedView)

      expect(findFeedContainer(root)).toBe(feedView)
    })
  })
})
