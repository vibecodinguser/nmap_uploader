// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NMAP_UPLOADER_MSG_SOURCE } from '@/lib/go_to_map_sync'
import { NMAPS_ORIGIN } from '@/lib/extension_origins'
import nakarteSyncMainScript from '@/entrypoints/nakarte-sync-main.content'
import {
  createContentScriptContext,
  mockIframeWindow,
} from '@/tests/setup/content_script_context'

describe('nakarte-sync-main.content', () => {
  let restoreIframe: (() => void) | undefined
  let ctx: ReturnType<typeof createContentScriptContext>

  beforeEach(() => {
    window.location.hash = '#m=10/55.0/37.0&l=S/K'
    ctx = createContentScriptContext()
  })

  afterEach(() => {
    restoreIframe?.()
    restoreIframe = undefined
  })

  it('не инициализируется в top frame', () => {
    nakarteSyncMainScript.main?.(ctx)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: NMAP_UPLOADER_MSG_SOURCE,
          type: 'set_location',
          location: { longitude: 37.6, latitude: 55.7, zoom: 12 },
        },
        origin: NMAPS_ORIGIN,
        source: window.parent,
      }),
    )

    expect(window.location.hash).toBe('#m=10/55.0/37.0&l=S/K')
  })

  it('применяет set_location от родителя n.maps во iframe', () => {
    restoreIframe = mockIframeWindow()
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: window,
    })

    nakarteSyncMainScript.main?.(ctx)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: NMAP_UPLOADER_MSG_SOURCE,
          type: 'set_location',
          location: { longitude: 37.6123456, latitude: 55.7123456, zoom: 12 },
        },
        origin: NMAPS_ORIGIN,
        source: window.parent,
      }),
    )

    expect(window.location.hash).toBe('#m=12/55.71235/37.61235&l=S/K')
  })

  it('игнорирует сообщения с чужим origin', () => {
    restoreIframe = mockIframeWindow()
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: window,
    })

    nakarteSyncMainScript.main?.(ctx)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: NMAP_UPLOADER_MSG_SOURCE,
          type: 'set_location',
          location: { longitude: 37.6, latitude: 55.7, zoom: 12 },
        },
        origin: 'https://evil.example',
        source: window.parent,
      }),
    )

    expect(window.location.hash).toBe('#m=10/55.0/37.0&l=S/K')
  })
})
