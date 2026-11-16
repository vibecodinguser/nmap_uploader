// @vitest-environment happy-dom

/**
 * Одна нарисованная фигура — одна заметка.
 *
 * Сообщение `NOTES_DRAW_FINISHED` приходит в панель дважды: напрямую от
 * content script (он отправляет `runtime.sendMessage`, а его получают все
 * страницы расширения, включая iframe панели) и ещё раз широковещательно от
 * background. Панель обязана отреагировать только на первое.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import {
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_SAVE_NOTE_ACTION,
  NOTES_START_DRAW_ACTION,
  type NotesSnapshot,
} from '@/lib/notes/protocol'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const snapshot: NotesSnapshot = {
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

const drawFinished = { action: NOTES_DRAW_FINISHED_ACTION, kind: 'Point', coords: [[37.6, 55.7]] }

describe('одна фигура — одна заметка', () => {
  let listeners: Array<(message: Record<string, unknown>) => void> = []
  let sent: Array<Record<string, unknown>> = []
  /** «Диск»: накапливает сохранённые заметки, как это делает background. */
  let stored: NotesSnapshot['manifest']['notes'] = []

  beforeEach(async () => {
    await resetBrowserMocks()
    listeners = []
    sent = []
    stored = []

    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation(((listener: never) => {
      listeners.push(listener)
    }) as never)

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((
      message: Record<string, unknown>,
    ) => {
      sent.push(message)
      if (message.action === NOTES_LOAD_ACTION) return Promise.resolve({ ok: true, snapshot })
      if (message.action === NOTES_SAVE_NOTE_ACTION) {
        const saved = message.note as NotesSnapshot['manifest']['notes'][number]
        stored = [...stored.filter((note) => note.id !== saved.id), saved]
      }
      return Promise.resolve({
        ok: true,
        patch: { manifest: { ...snapshot.manifest, notes: stored }, shards: {} },
      })
    }) as never)
  })

  const deliver = (message: Record<string, unknown>): void => {
    for (const listener of listeners) listener(message)
  }

  it('второе сообщение о том же рисовании не создаёт вторую заметку', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.startDrawing('Point')
    })

    // Панель получает событие дважды: напрямую от content script и от
    // background — так и приходят эти два сообщения в живом расширении.
    act(() => {
      deliver(drawFinished)
      deliver(drawFinished)
    })

    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(sent.filter((message) => message.action === NOTES_SAVE_NOTE_ACTION)).toHaveLength(1)
  })

  it('не создаёт заметку, если панель не в режиме рисования', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      deliver(drawFinished)
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(result.current.notes).toHaveLength(0)
    expect(sent.filter((message) => message.action === NOTES_START_DRAW_ACTION)).toHaveLength(0)
  })

  it('после отмены рисования сообщение игнорируется', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.startDrawing('Point')
    })
    act(() => {
      result.current.cancelDrawing()
    })
    act(() => {
      deliver(drawFinished)
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(result.current.notes).toHaveLength(0)
  })

  it('второе рисование после первого создаёт новую заметку', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.startDrawing('Point')
    })
    act(() => {
      deliver(drawFinished)
    })
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.startDrawing('Point')
    })
    act(() => {
      deliver(drawFinished)
    })

    await waitFor(() => expect(result.current.notes).toHaveLength(2))
  })
})
