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
    it('устанавливает атрибут на documentElement и внедряет тег style', () => {
      setSystemBannerSuppressed(true)
      expect(document.documentElement.getAttribute(HIDER_ATTR)).toBe('true')

      const styleEl = document.getElementById(HIDER_STYLE_ID)
      expect(styleEl).not.toBeNull()
      expect(styleEl?.textContent).toContain('display: none !important;')

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

    it('возвращает сам элемент, если это изолированный блок сообщения', () => {
      const message = document.createElement('div')
      message.className = 'nk-toolbar__message'
      expect(getSystemBannerContainer(message)).toBe(message)
    })

    it('находит ближайший контейнер сообщения при клике по вложенному элементу', () => {
      const banner = document.createElement('div')
      banner.className = 'nk-notification'
      const span = document.createElement('span')
      banner.appendChild(span)

      expect(getSystemBannerContainer(span)).toBe(banner)
    })
  })

  describe('hideSystemBannerElement и restoreSystemBanners', () => {
    it('скрывает контейнер сообщения и корректно восстанавливает видимость', () => {
      const banner = document.createElement('div')
      banner.className = 'nk-toolbar__message'
      document.body.appendChild(banner)

      hideSystemBannerElement(banner)
      expect(banner.style.display).toBe('none')
      expect(banner.getAttribute('data-nmap-hidden-system-banner')).toBe('true')

      restoreSystemBanners(document)
      expect(banner.style.display).toBe('')
      expect(banner.getAttribute('data-nmap-hidden-system-banner')).toBeNull()
    })
  })
})
