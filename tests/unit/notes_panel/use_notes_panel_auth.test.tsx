// @vitest-environment happy-dom

/**
 * Панель заметок не должна залипать в состоянии «Войдите в Яндекс».
 *
 * iframe панели живёт постоянно, поэтому вход в Яндекс происходит уже после
 * монтирования: единственный сигнал об этом — изменение `storage.local`.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '@/lib/yandex/constants'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const emptySnapshot = {
  manifest: {
    version: 1,
    updatedAt: '2026-11-14T10:00:00.000Z',
    groups: [],
    notes: [],
    deletedNotes: [],
  },
  shards: {},
  hiddenIds: [],
}

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

describe('useNotesPanel: авторизация', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('показывает приглашение войти, если токена нет', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({
      ok: false,
      error: 'AUTH_REQUIRED',
    } as never)

    const { result } = renderPanel()

    await waitFor(() => expect(result.current.status).toBe('auth'))
  })

  it('перезагружает заметки, когда токен появился в storage', async () => {
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockResolvedValueOnce({ ok: false, error: 'AUTH_REQUIRED' } as never)
      .mockResolvedValue({ ok: true, snapshot: emptySnapshot } as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('auth'))
    const beforeLogin = sendMessage.mock.calls.length

    await act(async () => {
      await browser.storage.local.set({
        [STORAGE_TOKEN_KEY]: 'token',
        [STORAGE_USER_KEY]: { id: '1', login: 'user' },
      })
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(sendMessage.mock.calls.length).toBeGreaterThan(beforeLogin)
  })

  it('возвращается к приглашению, если токен стёрли', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({
      ok: true,
      snapshot: emptySnapshot,
    } as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await browser.storage.local.remove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY])
    })

    await waitFor(() => expect(result.current.status).toBe('auth'))
  })

  it('после входа из панели перезапрашивает данные', async () => {
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockResolvedValueOnce({ ok: false, error: 'AUTH_REQUIRED' } as never)
      .mockResolvedValueOnce({ ok: true } as never)
      .mockResolvedValue({ ok: true, snapshot: emptySnapshot } as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('auth'))

    await act(async () => {
      result.current.login()
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(sendMessage).toHaveBeenCalledWith({ action: 'login' })
  })
})
