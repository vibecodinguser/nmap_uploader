// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  findSystemRemainingVertices,
  parseSystemLimitText,
} from '@/lib/point_counter/system_banner'

describe('point_counter/system_banner', () => {
  describe('parseSystemLimitText', () => {
    it('парсит системный баннер с оставшимися вершинами на русском языке', () => {
      expect(parseSystemLimitText('Лимит — 500 вершин. Можно нарисовать ещё 11 вершин')).toBe(11)

      expect(parseSystemLimitText('Лимит: 500 вершин. Можно нарисовать ещё 1 вершину')).toBe(1)

      expect(parseSystemLimitText('Лимит - 500 вершин. Можно нарисовать ещё 2 вершины')).toBe(2)

      expect(parseSystemLimitText('Осталось ещё 45 вершин')).toBe(45)
    })

    it('парсит системный баннер на английском языке', () => {
      expect(parseSystemLimitText('Limit — 500 vertices. You can draw 11 more vertices')).toBe(11)

      expect(parseSystemLimitText('1 more vertex')).toBe(1)
    })

    it('возвращает 0 при исчерпании лимита', () => {
      expect(parseSystemLimitText('Лимит — 500 вершин. Лимит достигнут')).toBe(0)
      expect(parseSystemLimitText('Нельзя нарисовать больше вершин')).toBe(0)
      expect(parseSystemLimitText('Limit reached')).toBe(0)
    })

    it('возвращает отрицательное число при превышении лимита', () => {
      expect(parseSystemLimitText('Лимит превышен на 5 вершин')).toBe(-5)
      expect(parseSystemLimitText('Limit exceeded by 3 vertices')).toBe(-3)
    })

    it('возвращает null при отсутствии данных о лимите', () => {
      expect(parseSystemLimitText('')).toBeNull()
      expect(parseSystemLimitText('Простой текст на карте')).toBeNull()
      expect(parseSystemLimitText(null)).toBeNull()
      expect(parseSystemLimitText(undefined)).toBeNull()
    })
  })

  describe('findSystemRemainingVertices', () => {
    beforeEach(() => {
      document.body.innerHTML = ''
    })

    it('находит системное сообщение в панели инструментов и извлекает остаток', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'

      const warning = document.createElement('div')
      warning.className = 'nk-toolbar__message-warning'
      warning.textContent = 'Лимит — 500 вершин. Можно нарисовать ещё 11 вершин'
      toolbar.appendChild(warning)
      document.body.appendChild(toolbar)

      expect(findSystemRemainingVertices(document)).toBe(11)
    })

    it('находит системное сообщение в специализированных блоках сообщений/нотификаций', () => {
      const banner = document.createElement('div')
      banner.className = 'nk-on-map-toolbar__message'
      banner.textContent = 'Лимит — 500 вершин. Можно нарисовать ещё 5 вершин'
      document.body.appendChild(banner)

      expect(findSystemRemainingVertices(document)).toBe(5)
    })

    it('возвращает null, когда предупреждения о лимите нет', () => {
      const normalDiv = document.createElement('div')
      normalDiv.textContent = 'Обычный элемент интерфейса'
      document.body.appendChild(normalDiv)

      expect(findSystemRemainingVertices(document)).toBeNull()
    })
  })
})
