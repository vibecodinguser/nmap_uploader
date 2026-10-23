// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { FEEDS_FILTER_SELECT_ID } from '@/lib/feeds_filter/constants'
import { createFilterDropdownElement } from '@/lib/feeds_filter/dom_dropdown'
import {
  isEditsModeSelected,
  isValidTargetSelect,
} from '@/lib/feeds_filter/target_select_validator'

describe('feeds_filter target_select_validator', () => {
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
})
