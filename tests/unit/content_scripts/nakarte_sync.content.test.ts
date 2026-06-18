// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NAKARTE_SYNC_MSG_SOURCE } from '@/lib/go_to_map_sync'
import { NMAPS_ORIGIN } from '@/lib/extension_origins'
import nakarteSyncScript from '@/entrypoints/nakarte-sync.content'
import {
  createContentScriptContext,
  mockIframeWindow,
  spyParentPostMessage,
} from '@/tests/setup/content_script_context'

describe('nakarte-sync.content', () => {
  let restoreIframe: (() => void) | undefined
  let restoreParent: (() => void) | undefined
  let ctx: ReturnType<typeof createContentScriptContext>

  beforeEach(() => {
    window.location.hash = '#m=14/44.969538/39.187968&l=S/K'
    ctx = createContentScriptContext()
  })

  afterEach(() => {
    ctx.runInvalidated()
    restoreIframe?.()
    restoreParent?.()
    restoreIframe = undefined
    restoreParent = undefined
    document.body.replaceChildren()
  })

  it('не инициализируется в top frame', () => {
    const parentSpy = spyParentPostMessage()
    restoreParent = parentSpy.restore

    nakarteSyncScript.main?.(ctx)
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(parentSpy.messages).toHaveLength(0)
  })

  it('отправляет location родителю при hashchange во iframe', async () => {
    restoreIframe = mockIframeWindow()
    const parentSpy = spyParentPostMessage()
    restoreParent = parentSpy.restore

    nakarteSyncScript.main?.(ctx)
    await vi.waitFor(() => expect(parentSpy.messages.length).toBeGreaterThan(0))

    const locationMessage = parentSpy.messages.find(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: string }).type === 'location',
    )

    expect(locationMessage).toEqual({
      source: NAKARTE_SYNC_MSG_SOURCE,
      type: 'location',
      location: {
        longitude: 39.187968,
        latitude: 44.969538,
        zoom: 14,
      },
    })
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'location' }),
      NMAPS_ORIGIN,
    )
  })

  it('отправляет cursor при mousemove над #map', async () => {
    restoreIframe = mockIframeWindow()
    const parentSpy = spyParentPostMessage()
    restoreParent = parentSpy.restore

    const map = document.createElement('div')
    map.id = 'map'
    Object.defineProperty(map, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    })
    document.body.appendChild(map)

    nakarteSyncScript.main?.(ctx)
    await vi.waitFor(() => expect(parentSpy.messages.some((m) => (m as { type?: string }).type === 'location')).toBe(true))
    parentSpy.messages.length = 0

    map.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
        bubbles: true,
      }),
    )

    const cursorMessage = parentSpy.messages.find(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: string }).type === 'cursor',
    )

    expect(cursorMessage).toEqual({
      source: NAKARTE_SYNC_MSG_SOURCE,
      type: 'cursor',
      location: expect.objectContaining({
        longitude: expect.any(Number),
        latitude: expect.any(Number),
        zoom: 14,
      }),
    })
  })

  it('сбрасывает cursor при mouseleave с #map', async () => {
    restoreIframe = mockIframeWindow()
    const parentSpy = spyParentPostMessage()
    restoreParent = parentSpy.restore

    const map = document.createElement('div')
    map.id = 'map'
    Object.defineProperty(map, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    })
    document.body.appendChild(map)

    nakarteSyncScript.main?.(ctx)
    await vi.waitFor(() => expect(parentSpy.messages.length).toBeGreaterThan(0))
    parentSpy.messages.length = 0

    map.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))

    expect(parentSpy.messages.at(-1)).toEqual({
      source: NAKARTE_SYNC_MSG_SOURCE,
      type: 'cursor',
      location: null,
    })
  })

  it('уведомляет о location после history.pushState', async () => {
    restoreIframe = mockIframeWindow()
    const parentSpy = spyParentPostMessage()
    restoreParent = parentSpy.restore

    nakarteSyncScript.main?.(ctx)
    await vi.waitFor(() => expect(parentSpy.messages.length).toBeGreaterThan(0))
    parentSpy.messages.length = 0

    history.pushState(null, '', '#m=15/45.0/40.0&l=S/K')

    await vi.waitFor(() =>
      expect(
        parentSpy.messages.some(
          (message) =>
            typeof message === 'object' &&
            message !== null &&
            (message as { type?: string }).type === 'location',
        ),
      ).toBe(true),
    )
  })
})
