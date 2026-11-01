// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  findSystemRemainingVertices,
  getSystemBannerContainer,
  HIDER_ATTR,
  HIDER_STYLE_ID,
  parseSystemLimitText,
  restoreSystemBanners,
  setSystemBannerSuppressed,
} from '@/lib/point_counter/system_banner'

describe('point_counter/system_banner', () => {
  describe('parseSystemLimitText', () => {
    it('парсит системный баннер с оставшимися вершинами на русском языке', () => {
      expect(parseSystemLimitText('Лимит — 500 вершин. Можно нарисовать ещё 11 вершин')).toBe(11)

      expect(parseSystemLimitText('Лимит: 500 вершин. Можно нарисовать ещё 1 вершину')).toBe(1)

      expect(parseSystemLimitText('Лимит - 500 вершин. Можно нарисовать ещё 2 вершины')).toBe(2)

      expect(parseSystemLimitText('Лимит — 500 вершин. Можно нарисовать ещё 4 вершины')).toBe(4)

      expect(parseSystemLimitText('Осталось ещё 45 вершин')).toBe(45)
    })

    it('парсит системный баннер на английском языке', () => {
      expect(parseSystemLimitText('Limit — 500 vertices. You can draw 11 more vertices')).toBe(11)

      expect(parseSystemLimitText('1 more vertex')).toBe(1)
    })

    it('возвращает 0 при исчерпании лимита', () => {
      expect(parseSystemLimitText('Лимит — 500 вершин. Лимит достигнут')).toBe(0)
      expect(parseSystemLimitText('Лимит достигнут')).toBe(0)
      expect(parseSystemLimitText('Лимит исчерпан')).toBe(0)
      expect(parseSystemLimitText('Нельзя нарисовать больше вершин')).toBe(0)
      expect(parseSystemLimitText('Нельзя нарисовать больше')).toBe(0)
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

    it('скрывает системное сообщение при shouldHide = true и не затрагивает тулбар с кнопками', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'

      const button = document.createElement('button')
      button.className = 'nk-button'
      toolbar.appendChild(button)

      const warning = document.createElement('div')
      warning.className = 'nk-toolbar__message-warning'
      warning.textContent = 'Лимит — 500 вершин. Можно нарисовать ещё 11 вершин'
      toolbar.appendChild(warning)
      document.body.appendChild(toolbar)

      const remaining = findSystemRemainingVertices(document, true)
      expect(remaining).toBe(11)

      // Сообщение скрыто
      expect(warning.style.display).toBe('none')
      expect(warning.getAttribute('data-nmap-hidden-system-banner')).toBe('true')

      // Сам тулбар остается видимым!
      expect(toolbar.style.display).not.toBe('none')

      // Восстановление видимости
      restoreSystemBanners(document)
      expect(warning.style.display).toBe('')
      expect(warning.getAttribute('data-nmap-hidden-system-banner')).toBeNull()
    })

    it('getSystemBannerContainer определяет контейнер сообщения безопасно', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      const btn = document.createElement('button')
      toolbar.appendChild(btn)

      const message = document.createElement('div')
      message.className = 'nk-toolbar__message'
      toolbar.appendChild(message)

      expect(getSystemBannerContainer(toolbar)).toBe(message)
      expect(getSystemBannerContainer(message)).toBe(message)
    })

    it('скрывает сообщение об исчерпании лимита ("Лимит достигнут")', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'

      const alert = document.createElement('div')
      alert.className = 'nk-toolbar__message-alert'
      alert.textContent = 'Лимит достигнут'
      toolbar.appendChild(alert)
      document.body.appendChild(toolbar)

      const remaining = findSystemRemainingVertices(document, true)
      expect(remaining).toBe(0)
      expect(alert.style.display).toBe('none')
    })

    it('setSystemBannerSuppressed управляет атрибутом документа и внедрением CSS-стилей', () => {
      setSystemBannerSuppressed(true)
      expect(document.documentElement.getAttribute(HIDER_ATTR)).toBe('true')
      expect(document.getElementById(HIDER_STYLE_ID)).not.toBeNull()

      setSystemBannerSuppressed(false)
      expect(document.documentElement.getAttribute(HIDER_ATTR)).toBeNull()
    })
  })
})
