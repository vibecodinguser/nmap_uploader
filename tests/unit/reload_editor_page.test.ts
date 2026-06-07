import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { reloadMapEditorTabs } from '@/lib/reload_editor_page'
import { resetBrowserMocks } from '../setup/browser_mock'

describe('reloadMapEditorTabs', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('перезагружает вкладку редактора через tabs.reload', async () => {
    const reload = vi.fn(async () => undefined)
    browser.tabs.reload = reload as typeof browser.tabs.reload
    browser.tabs.get = vi.fn(async () => ({
      id: 42,
      url: 'https://n.maps.yandex.ru/editor',
    })) as unknown as typeof browser.tabs.get

    const ok = await reloadMapEditorTabs({ preferredTabId: 42 })

    expect(ok).toBe(true)
    expect(reload).toHaveBeenCalledWith(42)
  })
})
