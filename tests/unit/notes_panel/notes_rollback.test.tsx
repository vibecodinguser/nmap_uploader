// @vitest-environment happy-dom

/**
 * Откат неудачной записи не должен уносить чужие изменения.
 *
 * Ошибка приходит через секунды после создания заметки. Если откатывать по
 * снимку, захваченному в момент вызова, вместе с неудачной заметкой исчезнут
 * и те, что пользователь успел создать за это время — ни на карте, ни в списке.
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
  type NotesSnapshot,
} from '@/lib/notes/protocol'
import { NOTES_PANEL_PREVIEW_MESSAGE } from '@/lib/notes_panel/host'
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

describe('откат неудачного создания', () => {
  let listeners: Array<(message: Record<string, unknown>) => void> = []
  let previews: NotesSnapshot[] = []
  let saveResolvers: Array<(response: unknown) => void> = []

  beforeEach(async () => {
    await resetBrowserMocks()
    listeners = []
    previews = []
    saveResolvers = []

    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation(((listener: never) => {
      listeners.push(listener)
    }) as never)

    vi.spyOn(window.parent, 'postMessage').mockImplementation(((message: never) => {
      const parsed = message as unknown as { action?: string; snapshot?: NotesSnapshot }
      if (parsed?.action === NOTES_PANEL_PREVIEW_MESSAGE && parsed.snapshot) {
        previews.push(parsed.snapshot)
      }
    }) as never)

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((message: { action?: string }) => {
      if (message.action === NOTES_LOAD_ACTION) return Promise.resolve({ ok: true, snapshot })
      if (message.action === NOTES_SAVE_NOTE_ACTION) {
        return new Promise((resolve) => {
          saveResolvers.push(resolve)
        })
      }
      return Promise.resolve({ ok: true, patch: { manifest: snapshot.manifest, shards: {} } })
    }) as never)
  })

  it('оставляет вторую заметку, когда первая не записалась', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.startDrawing('Point')
    })
    act(() => {
      for (const listener of listeners) {
        listener({ action: NOTES_DRAW_FINISHED_ACTION, kind: 'Point', coords: [[37.6, 55.7]] })
      }
    })
    act(() => {
      result.current.startDrawing('Point')
    })
    act(() => {
      for (const listener of listeners) {
        listener({ action: NOTES_DRAW_FINISHED_ACTION, kind: 'Point', coords: [[37.7, 55.8]] })
      }
    })

    await waitFor(() => expect(result.current.notes).toHaveLength(2))
    const [first, second] = result.current.notes

    await act(async () => {
      saveResolvers[0]?.({ ok: false, error: 'STORAGE_ERROR' })
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(result.current.notes[0]?.id).toBe(second?.id)
    expect(result.current.error).toBeTruthy()

    // Карта тоже видит только уцелевшую заметку — призрак неудачной исчез.
    expect(previews.at(-1)?.manifest.notes.map((note) => note.id)).toEqual([second?.id])
    expect(first?.id).not.toBe(second?.id)
  })
})
