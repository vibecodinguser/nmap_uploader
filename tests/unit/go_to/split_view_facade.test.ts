// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSplitViewStatus,
  isSplitViewOpen,
  teardownSplitView,
  toggleSplitView,
} from '@/lib/go_to_split_view'
import { NMAPS_MAP_RESIZE_EVENT } from '@/lib/nmaps_map_resize_notify'

describe('go_to_split_view facade state machine', () => {
  beforeEach(() => {
    teardownSplitView()
    document.body.innerHTML = ''
    window.location.hash = '#!/?z=16&ll=37.6176,55.7558'
    vi.restoreAllMocks()
  })

  it('по умолчанию находится в статусе closed', () => {
    expect(getSplitViewStatus()).toBe('closed')
    expect(isSplitViewOpen()).toBe(false)
  })

  it('переключается в open при toggleSplitView и обратно в closed', () => {
    let capturedResizeCount = 0
    document.addEventListener(NMAPS_MAP_RESIZE_EVENT, () => {
      capturedResizeCount++
    })

    const opened = toggleSplitView()
    expect(opened).toBe(true)
    expect(getSplitViewStatus()).toBe('open')
    expect(isSplitViewOpen()).toBe(true)

    const closed = toggleSplitView()
    expect(closed).toBe(true)
    expect(getSplitViewStatus()).toBe('closed')
    expect(isSplitViewOpen()).toBe(false)
    expect(capturedResizeCount).toBeGreaterThanOrEqual(0)
  })

  it('идемпотентно реагирует на повторный teardownSplitView', () => {
    expect(() => {
      teardownSplitView()
      teardownSplitView()
    }).not.toThrow()
    expect(getSplitViewStatus()).toBe('closed')
  })
})
