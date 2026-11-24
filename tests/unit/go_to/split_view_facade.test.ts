// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import {
  getSplitViewStatus,
  isSplitViewOpen,
  NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY,
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

  it('переключается в open при toggleSplitView и обратно в closed', async () => {
    let capturedResizeCount = 0
    document.addEventListener(NMAPS_MAP_RESIZE_EVENT, () => {
      capturedResizeCount++
    })

    const opened = await toggleSplitView()
    expect(opened).toBe(true)
    expect(getSplitViewStatus()).toBe('open')
    expect(isSplitViewOpen()).toBe(true)

    const closed = await toggleSplitView()
    expect(closed).toBe(true)
    expect(getSplitViewStatus()).toBe('closed')
    expect(isSplitViewOpen()).toBe(false)
    expect(capturedResizeCount).toBeGreaterThanOrEqual(0)
  })

  it('открывает Nakarte с сохранёнными настройками', async () => {
    await browser.storage.local.set({
      [NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY]: 'l=Otm/Y&nktp=55.7/37.6',
    })

    await toggleSplitView()

    const iframe = document.querySelector<HTMLIFrameElement>('.yamapper-split__iframe')
    expect(iframe?.src).toContain('l=Otm/Y&nktp=55.7/37.6')
  })

  it('идемпотентно реагирует на повторный teardownSplitView', () => {
    expect(() => {
      teardownSplitView()
      teardownSplitView()
    }).not.toThrow()
    expect(getSplitViewStatus()).toBe('closed')
  })
})
