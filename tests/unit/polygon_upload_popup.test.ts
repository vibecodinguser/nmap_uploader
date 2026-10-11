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

  it('не закрывает popup внешним кликом из того же стека, что и открытие', () => {
    const button = mountButton()
    button.addEventListener('click', () => {
      togglePolygonUploadPopup(button)
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(true)
  })

  it('не закрывает popup кликом на следующем тике после открытия', async () => {
    togglePolygonUploadPopup(mountButton())
    await new Promise((resolve) => setTimeout(resolve, 0))
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(true)
  })

  it('закрывает popup кликом снаружи', async () => {
    togglePolygonUploadPopup(mountButton())
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(isPolygonUploadPopupOpen()).toBe(false)
  })

  it('не закрывает popup кликом внутри', async () => {
    togglePolygonUploadPopup(mountButton())
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
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
