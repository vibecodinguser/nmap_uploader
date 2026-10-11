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
  it('открывает popup с iframe и классами редактора', () => {
    const button = mountButton()
    togglePolygonUploadPopup(button)
    const popup = document.getElementById(POLYGON_UPLOAD_POPUP_ID)

    expect(popup?.classList.contains('nk-popup_visible')).toBe(true)
    expect(popup?.classList.contains('nk-popup_direction_right-bottom')).toBe(true)
    expect(popup?.classList.contains('nk-popup_theme_islands')).toBe(true)
    expect(popup?.classList.contains('nk-popup_restrict-height')).toBe(true)
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

  it('закрывает popup кликом снаружи', () => {
    togglePolygonUploadPopup(mountButton())
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(false)
  })

  it('не закрывает popup кликом внутри', () => {
    togglePolygonUploadPopup(mountButton())
    document
      .getElementById(POLYGON_UPLOAD_POPUP_ID)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(true)
  })

  it('закрывает popup клавишей Escape', () => {
    togglePolygonUploadPopup(mountButton())
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(false)
  })
})
