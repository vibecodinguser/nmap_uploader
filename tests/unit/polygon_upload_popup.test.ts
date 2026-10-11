// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import {
  isPolygonUploadPopupOpen,
  POLYGON_UPLOAD_POPUP_ID,
  teardownPolygonUploadPopup,
  togglePolygonUploadPopup,
} from '@/lib/polygon_upload_popup'

const mountButton = (): HTMLButtonElement => {
  const button = document.createElement('button')
  button.id = 'polygonUploadButton'
  button.setAttribute('aria-label', 'Загрузить полигоны')
  document.body.appendChild(button)
  return button
}

beforeEach(() => {
  vi.spyOn(browser.runtime, 'getURL').mockReturnValue('about:blank')
})

afterEach(() => {
  teardownPolygonUploadPopup()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('polygon upload popup', () => {
  it('открывает popup с iframe и собственными классами расширения', () => {
    const button = mountButton()
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 800,
    })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(button, 'getBoundingClientRect', {
      value: () => ({
        top: 12,
        bottom: 44,
        left: 40,
        right: 72,
        width: 32,
        height: 32,
        x: 40,
        y: 12,
        toJSON: () => ({}),
      }),
    })
    togglePolygonUploadPopup(button)
    const popup = document.getElementById(POLYGON_UPLOAD_POPUP_ID)

    expect(popup?.className).not.toMatch(/nk-popup/)
    expect(popup?.classList.contains('nmap-uploader-popup--visible')).toBe(true)
    expect(popup?.classList.contains('nmap-uploader-polygon-popup')).toBe(true)
    expect(popup?.style.top).not.toBe('')
    expect(popup?.style.bottom).toBe('auto')
    expect(Number.parseFloat(popup?.style.maxHeight || '0')).toBeGreaterThan(100)
    expect(popup?.querySelector('iframe')?.getAttribute('title')).toBe('Загрузить полигоны')
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(isPolygonUploadPopupOpen()).toBe(true)
  })

  it('закрывает popup повторным нажатием и удаляет iframe', () => {
    const button = mountButton()
    togglePolygonUploadPopup(button)
    togglePolygonUploadPopup(button)

    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(isPolygonUploadPopupOpen()).toBe(false)
  })

  it('не закрывает popup pointerdown на кнопке открытия', () => {
    const button = mountButton()
    button.addEventListener('click', () => {
      togglePolygonUploadPopup(button)
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(true)
  })

  it('закрывает popup pointerdown снаружи', () => {
    togglePolygonUploadPopup(mountButton())
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(false)
  })

  it('не закрывает popup pointerdown внутри', () => {
    togglePolygonUploadPopup(mountButton())
    document
      .getElementById(POLYGON_UPLOAD_POPUP_ID)
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(true)
  })

  it('закрывает popup клавишей Escape', () => {
    togglePolygonUploadPopup(mountButton())
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(false)
  })

  it('не бросает и не открывает popup при invalidated extension context', () => {
    vi.spyOn(browser.runtime, 'getURL').mockImplementation(() => {
      throw new Error('Extension context invalidated.')
    })
    const button = mountButton()

    expect(() => togglePolygonUploadPopup(button)).not.toThrow()
    expect(isPolygonUploadPopupOpen()).toBe(false)
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).toBeNull()
    expect(button.getAttribute('aria-expanded')).not.toBe('true')
  })
})
