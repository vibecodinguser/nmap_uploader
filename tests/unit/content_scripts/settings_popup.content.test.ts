// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import settingsPopupScript from '@/entrypoints/settings-popup.content'
import {
  CLOSE_SETTINGS_POPUP_ACTION,
  SETTINGS_BUTTON_ID,
  SETTINGS_POPUP_ID,
  SETTINGS_POPUP_STYLES_ID,
  TOGGLE_SETTINGS_POPUP_ACTION,
} from '@/lib/settings_popup/protocol'
import { getURL } from '@/tests/setup/browser_mock'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const renderAppBar = (): void => {
  document.body.innerHTML = `
    <header class="nk-header-view">
      <div class="nk-app-bar-view">
        <button type="button" class="nk-button nk-help-view">?</button>
      </div>
    </header>
  `
}

const getPopup = (): HTMLElement | null => document.getElementById(SETTINGS_POPUP_ID)

describe('settings-popup.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>
  let messageListener: ((message: { action?: string }) => void) | undefined

  beforeEach(() => {
    ctx = createContentScriptContext()
    messageListener = undefined
    renderAppBar()

    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation((listener) => {
      messageListener = listener as (message: { action?: string }) => void
    })
    vi.mocked(getURL).mockImplementation((path: string) => {
      if (path === '/panel.html') return 'about:blank'
      const normalized = path.replace(/^\//, '')
      return `chrome-extension://test-extension-id/${normalized}`
    })
  })

  afterEach(() => {
    ctx.runInvalidated()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('вставляет кнопку в шапку редактора', async () => {
    settingsPopupScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(SETTINGS_BUTTON_ID)).not.toBeNull())
    expect(getURL).not.toHaveBeenCalled()
  })

  it('вставляет стили кнопки, не дожидаясь открытия попапа', async () => {
    settingsPopupScript.main?.(ctx)
    await vi.waitFor(() => expect(document.getElementById(SETTINGS_BUTTON_ID)).not.toBeNull())

    const styles = document.getElementById(SETTINGS_POPUP_STYLES_ID)?.textContent ?? ''
    expect(styles).toContain('.yamapper-settings-button')
    expect(styles).toContain('margin-left: 8px')
    expect(getPopup()).toBeNull()
  })

  it('открывает попап по клику на кнопку', async () => {
    settingsPopupScript.main?.(ctx)
    await vi.waitFor(() => expect(document.getElementById(SETTINGS_BUTTON_ID)).not.toBeNull())

    document.getElementById(SETTINGS_BUTTON_ID)?.click()

    await vi.waitFor(() => expect(getPopup()).not.toBeNull())
    expect(getURL).toHaveBeenCalledWith('/panel.html')
    expect(getPopup()?.querySelector('iframe')).toBeInstanceOf(HTMLIFrameElement)
  })

  it('переключает попап сообщением из background', async () => {
    settingsPopupScript.main?.(ctx)
    await vi.waitFor(() => expect(messageListener).toBeTypeOf('function'))

    messageListener?.({ action: TOGGLE_SETTINGS_POPUP_ACTION })
    await vi.waitFor(() => expect(getPopup()).not.toBeNull())

    messageListener?.({ action: TOGGLE_SETTINGS_POPUP_ACTION })
    await vi.waitFor(() => expect(getPopup()).toBeNull())
  })

  it('закрывает попап по closeSettingsPopup', async () => {
    settingsPopupScript.main?.(ctx)
    await vi.waitFor(() => expect(messageListener).toBeTypeOf('function'))

    messageListener?.({ action: TOGGLE_SETTINGS_POPUP_ACTION })
    await vi.waitFor(() => expect(getPopup()).not.toBeNull())

    messageListener?.({ action: CLOSE_SETTINGS_POPUP_ACTION })
    expect(getPopup()).toBeNull()
  })

  it('убирает кнопку и попап при выгрузке расширения', async () => {
    settingsPopupScript.main?.(ctx)
    await vi.waitFor(() => expect(document.getElementById(SETTINGS_BUTTON_ID)).not.toBeNull())

    messageListener?.({ action: TOGGLE_SETTINGS_POPUP_ACTION })
    await vi.waitFor(() => expect(getPopup()).not.toBeNull())

    ctx.runInvalidated()

    expect(document.getElementById(SETTINGS_BUTTON_ID)).toBeNull()
    expect(getPopup()).toBeNull()
  })
})
