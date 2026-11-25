// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import nativeLocaleScript from '@/entrypoints/native-locale.content'
import { NATIVE_LOCALE_MESSAGE } from '@/lib/locale_bridge'
import { getURL, resetBrowserMocks } from '@/tests/setup/browser_mock'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

describe('native-locale.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>

  beforeEach(async () => {
    await resetBrowserMocks()
    ctx = createContentScriptContext()
    document.body.replaceChildren()
    document.documentElement.lang = 'ru'
  })

  afterEach(() => {
    ctx.runInvalidated()
  })

  it('передаёт язык редактора в iframe панели', async () => {
    document.documentElement.lang = 'en'

    const frame = document.createElement('iframe')
    frame.src = getURL('/panel.html')
    document.body.append(frame)

    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')

    nativeLocaleScript.main?.(ctx)

    expect(postMessage).toHaveBeenCalledWith({ action: NATIVE_LOCALE_MESSAGE, locale: 'en' }, '*')

    document.documentElement.lang = 'ru'

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenLastCalledWith(
        { action: NATIVE_LOCALE_MESSAGE, locale: 'ru' },
        '*',
      )
    })
  })

  it('досылает язык после загрузки iframe', () => {
    document.documentElement.lang = 'en'

    const frame = document.createElement('iframe')
    frame.src = getURL('/notes-panel.html')
    document.body.append(frame)

    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')

    nativeLocaleScript.main?.(ctx)
    postMessage.mockClear()
    frame.contentWindow?.dispatchEvent(new Event('load', { bubbles: false }))
    frame.dispatchEvent(new Event('load'))

    expect(postMessage).toHaveBeenCalledWith({ action: NATIVE_LOCALE_MESSAGE, locale: 'en' }, '*')
  })
})
