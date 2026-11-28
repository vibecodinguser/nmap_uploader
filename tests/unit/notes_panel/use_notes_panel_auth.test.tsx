// @vitest-environment happy-dom

/**
 * Панель заметок не должна залипать в состоянии «Войдите в Яндекс».
 *
 * iframe панели живёт постоянно, поэтому вход в Яндекс происходит уже после
 * монтирования: единственный сигнал об этом — изменение `storage.local`.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  afterEach(() => {
    // Панель живёт постоянно: без явной очистки хуки прошлых тестов
    // продолжают отвечать на сообщения и портят счётчики вызовов.
    cleanup()
    // `vi.spyOn` поверх уже подменённого метода возвращает тот же мок, поэтому
    // без восстановления вызовы прошлых тестов попадают в счётчик текущего.
    vi.restoreAllMocks()
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
    let tokenSaved = false
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(async (message: unknown) => {
        const action = (message as { action?: string }).action
        if (action === 'login') return { ok: true } as never
        return (
          tokenSaved ? { ok: true, snapshot: emptySnapshot } : { ok: false, error: 'AUTH_REQUIRED' }
        ) as never
      })

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('auth'))
    const beforeLogin = sendMessage.mock.calls.length

    tokenSaved = true
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
    let loginDone = false
    let loginAttempts = 0
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(async (message: unknown) => {
        const action = (message as { action?: string }).action
        if (action === 'login') {
          loginAttempts += 1
          // Первая попытка — автоматическая при открытии: она «отменена».
          // Вторая — кнопка «Войти», и только после неё появляются данные.
          if (loginAttempts > 1) loginDone = true
          return { ok: true } as never
        }
        return (
          loginDone ? { ok: true, snapshot: emptySnapshot } : { ok: false, error: 'AUTH_REQUIRED' }
        ) as never
      })

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('auth'))

    await act(async () => {
      result.current.login()
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(sendMessage).toHaveBeenCalledWith({ action: 'login' })
  })

  it('сразу запускает вход при открытии панели без токена', async () => {
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(async (message: unknown) => {
        const action = (message as { action?: string }).action
        return (action === 'login' ? { ok: true } : { ok: false, error: 'AUTH_REQUIRED' }) as never
      })

    renderPanel()

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ action: 'login' }))
  })

  it('не повторяет вход после отмены, пока панель не откроют заново', async () => {
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(async (message: unknown) => {
        const action = (message as { action?: string }).action
        return (action === 'login' ? { ok: true } : { ok: false, error: 'AUTH_REQUIRED' }) as never
      })

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('auth'))

    const loginCalls = (): number =>
      sendMessage.mock.calls.filter(
        ([message]) => (message as { action?: string }).action === 'login',
      ).length
    expect(loginCalls()).toBe(1)

    const callsBeforeReload = sendMessage.mock.calls.length
    await act(async () => {
      await browser.storage.local.set({ [STORAGE_TOKEN_KEY]: 'token' })
    })
    await waitFor(() => expect(sendMessage.mock.calls.length).toBeGreaterThan(callsBeforeReload))

    expect(loginCalls()).toBe(1)
  })
})
