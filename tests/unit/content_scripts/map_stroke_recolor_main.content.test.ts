// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NMAPS_ORIGIN } from '@/lib/extension_origins'
import {
  parseStrokeColorMessage,
  STROKE_COLOR_MESSAGE_TYPE,
  STROKE_COLOR_WINDOW_KEY,
} from '@/lib/stroke_color'
import mapStrokeRecolorMainScript from '@/entrypoints/map-stroke-recolor-main.content'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const runMain = (): void => {
  mapStrokeRecolorMainScript.main?.(createContentScriptContext())
}

describe('map-stroke-recolor-main.content', () => {
  beforeEach(() => {
    window.location.href = `${NMAPS_ORIGIN}/`
  })

  afterEach(() => {
    delete window[STROKE_COLOR_WINDOW_KEY]
  })

  it('применяет цвет контура из postMessage', () => {
    runMain()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: STROKE_COLOR_MESSAGE_TYPE, color: '#aabbcc' },
        origin: NMAPS_ORIGIN,
        source: window,
      }),
    )

    expect(window[STROKE_COLOR_WINDOW_KEY]).toBe('#aabbcc')
    expect(parseStrokeColorMessage({ type: STROKE_COLOR_MESSAGE_TYPE, color: '#aabbcc' })).toBe(
      '#aabbcc',
    )
  })

  it('игнорирует postMessage с чужим origin', () => {
    runMain()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: STROKE_COLOR_MESSAGE_TYPE, color: '#aabbcc' },
        origin: 'https://evil.example',
        source: window,
      }),
    )

    expect(window[STROKE_COLOR_WINDOW_KEY]).toBeUndefined()
  })
})
