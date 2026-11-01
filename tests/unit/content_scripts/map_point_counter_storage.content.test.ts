// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import mapPointCounterStorageScript from '@/entrypoints/map-point-counter-storage.content'
import {
  POINT_COUNTER_ENABLED_STORAGE_KEY,
  POINT_COUNTER_REQUEST_MSG,
  POINT_COUNTER_STATE_MSG,
} from '@/lib/point_counter/storage'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

describe('map-point-counter-storage.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>

  beforeEach(async () => {
    await resetBrowserMocks()
    ctx = createContentScriptContext()
  })

  afterEach(() => {
    ctx.runInvalidated()
    vi.restoreAllMocks()
  })

  it('при запуске отправляет начальное состояние через postMessage', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage')

    mapPointCounterStorageScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: POINT_COUNTER_STATE_MSG, enabled: true },
        '*',
      )
    })
  })

  it('отвечает на POINT_COUNTER_REQUEST_MSG текущим состоянием', async () => {
    await browser.storage.local.set({ [POINT_COUNTER_ENABLED_STORAGE_KEY]: false })
    const postMessageSpy = vi.spyOn(window, 'postMessage')

    mapPointCounterStorageScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: POINT_COUNTER_STATE_MSG, enabled: false },
        '*',
      )
    })

    postMessageSpy.mockClear()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: POINT_COUNTER_REQUEST_MSG },
        source: window,
      }),
    )

    await vi.waitFor(() => {
      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: POINT_COUNTER_STATE_MSG, enabled: false },
        '*',
      )
    })
  })
})
