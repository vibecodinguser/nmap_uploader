// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import mapStrokeRecolorScript from '@/entrypoints/map-stroke-recolor.content'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

describe('map-stroke-recolor.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>
  const originalUserAgent = navigator.userAgent

  beforeEach(() => {
    ctx = createContentScriptContext()
  })

  afterEach(() => {
    ctx.runInvalidated()
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    })
    vi.restoreAllMocks()
  })

  it('сохраняет флаг is_yandex_browser для YaBrowser', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 YaBrowser/24.1',
    })

    mapStrokeRecolorScript.main?.(ctx)

    await vi.waitFor(async () => {
      const stored = await browser.storage.local.get('is_yandex_browser')
      expect(stored.is_yandex_browser).toBe(true)
    })
  })

  it('не сохраняет флаг is_yandex_browser для других браузеров', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Chrome/120.0',
    })

    mapStrokeRecolorScript.main?.(ctx)
    await Promise.resolve()

    const stored = await browser.storage.local.get('is_yandex_browser')
    expect(stored.is_yandex_browser).toBeUndefined()
  })

  it('устанавливает stroke recolor engine', () => {
    mapStrokeRecolorScript.main?.(ctx)
    expect(
      (window as Window & { __NMAP_STROKE_RECOLOR_ENGINE__?: string })
        .__NMAP_STROKE_RECOLOR_ENGINE__,
    ).toBe('active')
  })
})
