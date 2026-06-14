import { describe, expect, it, vi } from 'vitest'
import {
  isNakarteOrigin,
  isNmapsOrigin,
  NAKARTE_ORIGIN,
  NMAPS_ORIGIN,
} from '@/lib/extension_origins'

describe('extension_origins', () => {
  it('распознаёт origin n.maps и nakarte', () => {
    expect(isNmapsOrigin(NMAPS_ORIGIN)).toBe(true)
    expect(isNakarteOrigin(NAKARTE_ORIGIN)).toBe(true)
  })

  it('отклоняет чужие origin', () => {
    expect(isNmapsOrigin('https://evil.com')).toBe(false)
    expect(isNakarteOrigin('https://evil.com')).toBe(false)
  })
})

describe('stroke_color postMessage', () => {
  it('postStrokeColorMessage использует origin n.maps', async () => {
    vi.stubGlobal('window', { postMessage: vi.fn() })
    const { NMAPS_ORIGIN } = await import('@/lib/extension_origins')
    const { postStrokeColorMessage, STROKE_COLOR_MESSAGE_TYPE } = await import('@/lib/stroke_color')

    postStrokeColorMessage('#aabbcc')

    expect(window.postMessage).toHaveBeenCalledWith(
      { type: STROKE_COLOR_MESSAGE_TYPE, color: '#aabbcc' },
      NMAPS_ORIGIN,
    )

    vi.unstubAllGlobals()
  })

  it('parseStrokeColorMessage нормализует hex', async () => {
    const { parseStrokeColorMessage, STROKE_COLOR_MESSAGE_TYPE } = await import(
      '@/lib/stroke_color'
    )

    expect(parseStrokeColorMessage({ type: STROKE_COLOR_MESSAGE_TYPE, color: 'abc' })).toBe(
      '#aabbcc',
    )
    expect(
      parseStrokeColorMessage({ type: STROKE_COLOR_MESSAGE_TYPE, color: 'not-a-color' }),
    ).toBeNull()
  })
})
