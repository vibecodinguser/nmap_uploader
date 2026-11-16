// @vitest-environment happy-dom

/**
 * Создание заметки должно откликаться мгновенно.
 *
 * После рисования на карте заметка раньше появлялась только после полного
 * цикла записи на Диск — несколько секунд, в течение которых «ничего не
 * происходило».
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { NOTES_DRAW_FINISHED_ACTION } from '@/lib/notes/protocol'
import { NOTES_PANEL_PREVIEW_MESSAGE } from '@/lib/notes_panel/host'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const snapshot = {
  manifest: { version: 1, updatedAt: '2026-11-14T10:00:00.000Z', groups: [], notes: [] },
  shards: {},
  hiddenIds: [],
}

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

describe('useNotesPanel: создание', () => {
  let listeners: Array<(message: Record<string, unknown>) => void> = []
  let previews: Array<{ manifest: { notes: Array<{ name: string }> } }> = []

  beforeEach(async () => {
    await resetBrowserMocks()
    listeners = []
    previews = []

    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation(((listener: never) => {
      listeners.push(listener)
    }) as never)

    // Панель — iframe: снимок уходит родителю напрямую.
    vi.spyOn(window.parent, 'postMessage').mockImplementation(((message: never) => {
      const parsed = message as unknown as { action?: string; snapshot?: never }
      if (parsed?.action === NOTES_PANEL_PREVIEW_MESSAGE) {
        previews.push(parsed.snapshot as never)
      }
    }) as never)
  })

  it('добавляет заметку и отдаёт её карте до ответа Диска', async () => {
    let resolveSave: (value: unknown) => void = () => {}
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((message: { action?: string }) => {
      if (message.action === 'NOTES_SAVE_NOTE') {
        return new Promise((resolve) => {
          resolveSave = resolve
        }) as never
      }
      return Promise.resolve({ ok: true, snapshot }) as never
    }) as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    // Панель ждёт результат рисования только в режиме рисования: иначе одно
    // сообщение, пришедшее по двум каналам, дало бы две заметки.
    act(() => {
      result.current.startDrawing('Point')
    })
    act(() => {
      for (const listener of listeners) {
        listener({ action: NOTES_DRAW_FINISHED_ACTION, kind: 'Point', coords: [[37, 55]] })
      }
    })

    // Диск ещё не ответил, а заметка уже в списке и на карте.
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(previews.at(-1)?.manifest.notes).toHaveLength(1)
    expect(result.current.mode).toBe('properties')

    await act(async () => {
      resolveSave({ ok: true, patch: { manifest: snapshot.manifest, shards: {} } })
      await Promise.resolve()
    })
  })

  it('убирает заметку, если сохранить не удалось', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((message: { action?: string }) => {
      if (message.action === 'NOTES_SAVE_NOTE') {
        return Promise.resolve({ ok: false, error: 'STORAGE_ERROR' }) as never
      }
      return Promise.resolve({ ok: true, snapshot }) as never
    }) as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.startDrawing('Line')
    })
    act(() => {
      for (const listener of listeners) {
        listener({
          action: NOTES_DRAW_FINISHED_ACTION,
          kind: 'Line',
          coords: [
            [37, 55],
            [38, 56],
          ],
        })
      }
    })

    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.notes).toHaveLength(0)
    expect(previews.at(-1)?.manifest.notes).toHaveLength(0)
  })
})
