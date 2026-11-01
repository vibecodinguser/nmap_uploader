// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getSystemBannerContainer,
  HIDER_ATTR,
  HIDER_STYLE_ID,
  hideSystemBannerElement,
  restoreSystemBanners,
  setSystemBannerSuppressed,
} from '@/lib/point_counter/banner_suppressor'

describe('point_counter/banner_suppressor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.removeAttribute(HIDER_ATTR)
    document.getElementById(HIDER_STYLE_ID)?.remove()
  })

  describe('setSystemBannerSuppressed', () => {
    it('устанавливает атрибут на documentElement и внедряет тег style строго для тулбара карты', () => {
      setSystemBannerSuppressed(true)
      expect(document.documentElement.getAttribute(HIDER_ATTR)).toBe('true')

      const styleEl = document.getElementById(HIDER_STYLE_ID)
      expect(styleEl).not.toBeNull()
      expect(styleEl?.textContent).toContain('.nk-on-map-toolbar')
      expect(styleEl?.textContent).toContain('display: none !important;')

      // Убеждаемся, что глобальные селекторы notification и чистый popup целиком не затронуты в CSS
      expect(styleEl?.textContent).not.toContain(
        'html[data-nmap-hide-system-banner="true"] [class*="notification"]',
      )
      expect(styleEl?.textContent).not.toContain(
        'html[data-nmap-hide-system-banner="true"] [class*="popup"] {',
      )
      expect(styleEl?.textContent).not.toContain(
        'html[data-nmap-hide-system-banner="true"] .nk-message_theme_error',
      )

      setSystemBannerSuppressed(false)
      expect(document.documentElement.getAttribute(HIDER_ATTR)).toBeNull()
      expect(document.getElementById(HIDER_STYLE_ID)).toBeNull()
    })
  })

  describe('getSystemBannerContainer', () => {
    it('находит внутренний блок сообщения, если передан контейнер с кнопками тулбара', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      const btn = document.createElement('button')
      toolbar.appendChild(btn)

      const message = document.createElement('div')
      message.className = 'nk-toolbar__message'
      toolbar.appendChild(message)

      expect(getSystemBannerContainer(toolbar)).toBe(message)
    })

    it('возвращает сам элемент, если это изолированный блок сообщения тулбара', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      const message = document.createElement('div')
      message.className = 'nk-on-map-toolbar__message'
      toolbar.appendChild(message)
      document.body.appendChild(toolbar)

      expect(getSystemBannerContainer(message)).toBe(message)
    })

    it('находит ближайший контейнер сообщения тулбара при клике по вложенному элементу', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      const banner = document.createElement('div')
      banner.className = 'nk-toolbar__message'
      const span = document.createElement('span')
      banner.appendChild(span)
      toolbar.appendChild(banner)
      document.body.appendChild(toolbar)

      expect(getSystemBannerContainer(span)).toBe(banner)
    })

    it('НЕ считает контейнером баннера глобальные системные уведомления карты (права доступа, ошибки)', () => {
      const notif = document.createElement('div')
      notif.className = 'nk-notification'
      notif.textContent = 'Недостаточно прав для выполнения операции'
      document.body.appendChild(notif)

      expect(getSystemBannerContainer(notif)).toBeNull()
    })
  })

  describe('hideSystemBannerElement и restoreSystemBanners', () => {
    it('скрывает контейнер сообщения тулбара и корректно восстанавливает видимость', () => {
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      const banner = document.createElement('div')
      banner.className = 'nk-toolbar__message'
      toolbar.appendChild(banner)
      document.body.appendChild(toolbar)

      hideSystemBannerElement(banner)
      expect(banner.style.display).toBe('none')
      expect(banner.getAttribute('data-nmap-hidden-system-banner')).toBe('true')

      restoreSystemBanners(document)
      expect(banner.style.display).toBe('')
      expect(banner.getAttribute('data-nmap-hidden-system-banner')).toBeNull()
    })
  })
})
