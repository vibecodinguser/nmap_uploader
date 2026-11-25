// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import nativeThemeScript from '@/entrypoints/native-theme.content'
import { NATIVE_THEME_MESSAGE } from '@/lib/theme_bridge'
import { getURL, resetBrowserMocks } from '@/tests/setup/browser_mock'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const stubSystemTheme = (): void => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('native-theme.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>

  beforeEach(async () => {
    await resetBrowserMocks()
    ctx = createContentScriptContext()
    document.body.replaceChildren()
    document.documentElement.className = ''
    stubSystemTheme()
  })

  afterEach(() => {
    ctx.runInvalidated()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('передаёт тему редактора в iframe панели', async () => {
    const page = document.createElement('div')
    page.className = 'nk-page nk-page_color-scheme_light'
    document.body.append(page)

    const frame = document.createElement('iframe')
    frame.src = getURL('/panel.html')
    document.body.append(frame)

    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')

    nativeThemeScript.main?.(ctx)

    expect(postMessage).toHaveBeenCalledWith({ action: NATIVE_THEME_MESSAGE, theme: 'light' }, '*')

    page.classList.replace('nk-page_color-scheme_light', 'nk-page_color-scheme_dark')

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenLastCalledWith(
        { action: NATIVE_THEME_MESSAGE, theme: 'dark' },
        '*',
      )
    })
  })

  it('досылает тему после загрузки iframe', () => {
    const page = document.createElement('div')
    page.className = 'nk-page nk-page_color-scheme_dark'
    document.body.append(page)

    const frame = document.createElement('iframe')
    frame.src = getURL('/notes-panel.html')
    document.body.append(frame)

    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')

    nativeThemeScript.main?.(ctx)
    postMessage.mockClear()
    frame.contentWindow?.dispatchEvent(new Event('load', { bubbles: false }))
    frame.dispatchEvent(new Event('load'))

    expect(postMessage).toHaveBeenCalledWith({ action: NATIVE_THEME_MESSAGE, theme: 'dark' }, '*')
  })
})
