// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { useNotesManagement } from '@/hooks/useNotesManagement'
import { downloadIndexJson, uploadIndexJson } from '@/lib/yandex/client'

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
    },
    runtime: {
      sendMessage: vi.fn(() => Promise.resolve()),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}))

vi.mock('@/lib/yandex/client', () => ({
  downloadIndexJson: vi.fn(),
  getStoredAuth: vi.fn(() => Promise.resolve({ token: 'mock-token' })),
  uploadIndexJson: vi.fn(() => Promise.resolve()),
}))

describe('useNotesManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(browser.storage.local.get as any).mockResolvedValue({})
    ;(browser.runtime.sendMessage as any).mockResolvedValue(undefined)
    vi.mocked(downloadIndexJson).mockResolvedValue(null)
  })

  it('инициализирует выбранную дату из трекера или локального хранилища', async () => {
    ;(browser.runtime.sendMessage as any).mockResolvedValue({ date: 'дата 15.08.2025 г.' })

    const onManualUpload = vi.fn()
    const { result } = renderHook(() =>
      useNotesManagement({
        isLoggedIn: true,
        onRequireAuth: vi.fn(),
        onManualUpload,
      }),
    )

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
    })

    expect(result.current.selectedDate).toBe('15-08-2025')
  })

  it('позволяет вручную изменить дату', async () => {
    const { result } = renderHook(() =>
      useNotesManagement({
        isLoggedIn: true,
        onRequireAuth: vi.fn(),
        onManualUpload: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
    })

    act(() => {
      result.current.setSelectedDate('20-09-2025')
    })

    expect(result.current.selectedDate).toBe('20-09-2025')
    expect(browser.storage.local.set).toHaveBeenCalledWith({ notes_selected_date: '20-09-2025' })
  })

  it('загружает точки для выбранной даты из индекса', async () => {
    ;(browser.storage.local.get as any).mockResolvedValue({
      notes_selected_date: '01-01-2025',
    })

    vi.mocked(downloadIndexJson).mockResolvedValue({
      points: {
        pt1: { coords: [37.6, 55.7], desc: 'Точка 1', note_desc: 'Описание 1' },
      },
      paths: {},
    })

    const { result } = renderHook(() =>
      useNotesManagement({
        isLoggedIn: true,
        onRequireAuth: vi.fn(),
        onManualUpload: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.points.length).toBe(1)
    })

    expect(result.current.points[0].id).toBe('pt1')
    expect(result.current.points[0].name).toBe('Точка 1')
  })
})
