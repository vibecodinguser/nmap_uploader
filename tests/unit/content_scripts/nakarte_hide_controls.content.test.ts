// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import nakarteHideControlsScript from '@/entrypoints/nakarte-hide-controls.content'
import { NAKARTE_EMBED_CLASS, NAKARTE_HIDE_CONTROLS_STYLE_ID } from '@/lib/go_to_split_view'
import { createContentScriptContext, mockIframeWindow } from '@/tests/setup/content_script_context'

const styleElement = (): HTMLElement | null =>
  document.getElementById(NAKARTE_HIDE_CONTROLS_STYLE_ID)

describe('nakarte-hide-controls.content', () => {
  let restoreIframe: (() => void) | undefined
  let ctx: ReturnType<typeof createContentScriptContext>

  beforeEach(() => {
    ctx = createContentScriptContext()
  })

  afterEach(() => {
    ctx.runInvalidated()
    restoreIframe?.()
    restoreIframe = undefined
    document.documentElement.classList.remove(NAKARTE_EMBED_CLASS)
    styleElement()?.remove()
  })

  it('не трогает nakarte.me в обычной вкладке', () => {
    nakarteHideControlsScript.main?.(ctx)

    expect(document.documentElement.classList.contains(NAKARTE_EMBED_CLASS)).toBe(false)
    expect(styleElement()).toBeNull()
  })

  it('скрывает контролы во встроенном режиме', () => {
    restoreIframe = mockIframeWindow()

    nakarteHideControlsScript.main?.(ctx)

    expect(document.documentElement.classList.contains(NAKARTE_EMBED_CLASS)).toBe(true)
    expect(styleElement()).not.toBeNull()
  })

  it('снимает маркер и лист при выгрузке расширения', () => {
    restoreIframe = mockIframeWindow()
    nakarteHideControlsScript.main?.(ctx)

    ctx.runInvalidated()

    expect(document.documentElement.classList.contains(NAKARTE_EMBED_CLASS)).toBe(false)
    expect(styleElement()).toBeNull()
  })
})
