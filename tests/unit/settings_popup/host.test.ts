// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureSettingsButton } from '@/lib/settings_popup/button'
import {
  createSettingsPopupHost,
  measureSettingsPopupRect,
  SETTINGS_POPUP_WIDTH,
} from '@/lib/settings_popup/host'
import { SETTINGS_POPUP_ID } from '@/lib/settings_popup/protocol'

const renderAppBar = (): HTMLElement => {
  document.body.innerHTML = `
    <header class="nk-header-view">
      <div class="nk-app-bar-view">
        <button type="button" class="nk-button nk-help-view">?</button>
      </div>
    </header>
  `
  const button = ensureSettingsButton({ locale: 'ru', onClick: () => {} })
  if (!button) throw new Error('button not rendered')
  // happy-dom не считает раскладку: задаём прямоугольник кнопки вручную.
  button.getBoundingClientRect = () =>
    ({
      x: 700,
      y: 16,
      top: 16,
      bottom: 54,
      left: 700,
      right: 738,
      width: 38,
      height: 38,
    }) as DOMRect
  return button
}

const getPopup = (): HTMLElement | null => document.getElementById(SETTINGS_POPUP_ID)

beforeEach(() => {
  document.body.innerHTML = '<div id="host-root"></div>'
})

afterEach(() => {
  for (const node of document.documentElement.querySelectorAll('#yamapper-settings-popup')) {
    node.remove()
  }
  document.body.innerHTML = ''
})

describe('геометрия попапа настроек', () => {
  it('стоит там же, где нативная .nk-sidebar-view', () => {
    // Замер у живого редактора: right 16px, верх острова на 70px.
    expect(measureSettingsPopupRect(1000, 800)).toEqual({
      left: 1000 - SETTINGS_POPUP_WIDTH - 16,
      top: 70,
      maxHeight: 800 - 70 - 16,
    })
  })

  it('сдвигается левее открытой выезжающей панели, как нативная', () => {
    expect(measureSettingsPopupRect(1200, 800, true).left).toBe(1200 - SETTINGS_POPUP_WIDTH - 366)
  })

  it('в узком окне не уходит левым краем за отступ', () => {
    expect(measureSettingsPopupRect(300, 800).left).toBe(16)
    expect(measureSettingsPopupRect(300, 50).maxHeight).toBe(0)
  })
})

describe('хост попапа настроек', () => {
  it('не держит узел в DOM, пока попап закрыт', () => {
    renderAppBar()
    const host = createSettingsPopupHost({ pagePath: '/panel.html', locale: 'ru' })

    expect(getPopup()).toBeNull()
    host.destroy()
  })

  it('открывает попап с iframe панели и закрывает повторным переключением', async () => {
    renderAppBar()
    const host = createSettingsPopupHost({ pagePath: '/panel.html', locale: 'ru' })

    host.toggle()
    await vi.waitFor(() => expect(getPopup()).not.toBeNull())

    const popup = getPopup()
    const iframe = popup?.querySelector('iframe')
    expect(iframe).toBeInstanceOf(HTMLIFrameElement)
    expect(iframe?.getAttribute('src')).toContain('panel.html')
    expect(popup?.getAttribute('role')).toBe('dialog')
    expect(popup?.className).toBe('yamapper-settings-popup')

    host.toggle()
    expect(getPopup()).toBeNull()
    host.destroy()
  })

  it('сообщает о видимости наружу и возвращает фокус кнопке при закрытии', async () => {
    renderAppBar()
    const onVisibilityChange = vi.fn()
    const host = createSettingsPopupHost({
      pagePath: '/panel.html',
      locale: 'ru',
      onVisibilityChange,
    })

    host.open()
    await vi.waitFor(() => expect(onVisibilityChange).toHaveBeenLastCalledWith(true))
    expect(host.isOpen()).toBe(true)

    host.close()
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
    expect(host.isOpen()).toBe(false)
    expect(document.activeElement?.id).toBe('yamapperSettingsButton')
    host.destroy()
  })

  it('закрывается по Escape', async () => {
    renderAppBar()
    const host = createSettingsPopupHost({ pagePath: '/panel.html', locale: 'ru' })
    host.open()
    await vi.waitFor(() => expect(getPopup()).not.toBeNull())

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(getPopup()).toBeNull()
    host.destroy()
  })

  it('закрывается по клику вне попапа', async () => {
    renderAppBar()
    const host = createSettingsPopupHost({ pagePath: '/panel.html', locale: 'ru' })
    host.open()
    await vi.waitFor(() => expect(getPopup()).not.toBeNull())

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(getPopup()).toBeNull()
    host.destroy()
  })

  it('закрывается по сообщению из панели', async () => {
    renderAppBar()
    const host = createSettingsPopupHost({ pagePath: '/panel.html', locale: 'ru' })
    host.open()
    await vi.waitFor(() => expect(getPopup()).not.toBeNull())

    const frame = getPopup()?.querySelector('iframe')
    window.dispatchEvent(
      new MessageEvent('message', {
        source: frame?.contentWindow,
        data: { action: 'closeSettingsPopup' },
      }),
    )

    expect(getPopup()).toBeNull()
    host.destroy()
  })

  it('ставит попап на место нативной боковой панели', async () => {
    renderAppBar()

    const host = createSettingsPopupHost({ pagePath: '/panel.html', locale: 'ru' })
    host.open()
    await vi.waitFor(() => expect(getPopup()).not.toBeNull())

    const popup = getPopup()
    const expected = measureSettingsPopupRect(
      document.documentElement.clientWidth,
      document.documentElement.clientHeight,
    )
    expect(popup?.style.width).toBe(`${SETTINGS_POPUP_WIDTH}px`)
    expect(popup?.style.left).toBe(`${expected.left}px`)
    expect(popup?.style.top).toBe('70px')
    host.destroy()
  })
})
