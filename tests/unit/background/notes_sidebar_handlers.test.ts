// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { handleUploadNoteFromSidebar } from '@/lib/background/notes_sidebar_handlers'
import { getStoredAuth } from '@/lib/yandex/client'

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { id: 'test-extension' },
  },
}))

vi.mock('@/lib/background/relay_handlers', () => ({
  processRelayToMapTabs: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/background/map_objects_handlers', () => ({
  setLastDrawMapObjects: vi.fn(),
}))

vi.mock('@/lib/nmaps_draw_objects', () => ({
  loadDrawMapObjectsForDate: vi.fn(() => Promise.resolve({ points: [], snapTargets: [] })),
}))

vi.mock('@/lib/upload/yandex_upload', () => ({
  uploadProcessedFilesToYandexDisk: vi.fn(() => Promise.resolve({ ok: true, logs: [] })),
}))

vi.mock('@/lib/yandex/client', () => ({
  getStoredAuth: vi.fn(),
  downloadIndexJson: vi.fn(),
}))

const validNote = {
  coords: [[37.6, 55.7]],
  geomType: 'Point',
  name: 'Дом',
  desc: '',
  date: '01-01-2025',
}

const nmapsSender = {
  id: 'test-extension',
  tab: { url: 'https://n.maps.yandex.ru/#!/objects/1' },
}

describe('handleUploadNoteFromSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('отклоняет отправителя со страницы расширения', () => {
    const sendResponse = vi.fn()

    const result = handleUploadNoteFromSidebar(
      { note: validNote },
      { id: 'test-extension', url: 'chrome-extension://test-extension/panel.html' },
      sendResponse,
    )

    expect(result).toBe(true)
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'ACCESS_DENIED' })
  })

  it('отклоняет некорректную заметку', () => {
    const sendResponse = vi.fn()

    handleUploadNoteFromSidebar({ note: { coords: [] } }, nmapsSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'INVALID_NOTE' })
  })

  it('просит войти, если нет авторизации', async () => {
    vi.mocked(getStoredAuth).mockResolvedValue(null)
    const sendResponse = vi.fn()

    handleUploadNoteFromSidebar({ note: validNote }, nmapsSender, sendResponse)

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'AUTH_REQUIRED' }),
    )
  })

  it('сохраняет заметку от content script Народной карты', async () => {
    vi.mocked(getStoredAuth).mockResolvedValue({
      token: 'token',
      user: { id: 'user' },
    } as never)
    const sendResponse = vi.fn()

    handleUploadNoteFromSidebar({ note: validNote }, nmapsSender, sendResponse)

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, error: undefined }),
    )
    expect(browser.runtime.id).toBe('test-extension')
  })
})
