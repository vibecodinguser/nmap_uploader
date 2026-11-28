// @vitest-environment happy-dom

/**
 * Открытие панели кнопкой заметок.
 *
 * Панель — постоянно смонтированный iframe: сам он не замечает, что его
 * открыли, поэтому хост присылает `NOTES_PANEL_OPENED`. По нему панель
 * возвращается к списку (ADR 0008) и один раз пробует войти в Яндекс.
 *
 * Раньше выбор заметки переживал закрытие панели, и если заметку успевали
 * удалить, панель открывалась пустой: ни карточки, ни списка.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { NOTES_PANEL_OPENED_MESSAGE } from '@/lib/notes_panel/host'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'
import { sampleNote } from './list_props'

const snapshotWith = (noteId: string) => ({
  manifest: {
    version: 1,
    updatedAt: '2026-11-14T10:00:00.000Z',
    groups: [],
    notes: [sampleNote({ id: noteId })],
    deletedNotes: [],
  },
  shards: {
    '2026-11': {
      version: 1,
      updatedAt: '2026-11-14T10:00:00.000Z',
      notes: { [noteId]: { kind: 'Point', coords: [37.6, 55.7] } },
    },
  },
  hiddenIds: [],
})

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

const notifyOpened = (): void => {
  window.dispatchEvent(
    new MessageEvent('message', { data: { action: NOTES_PANEL_OPENED_MESSAGE } }),
  )
}

describe('useNotesPanel: открытие панели', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const action = (message as { action?: string }).action
      if (action === 'NOTES_LOAD') return { ok: true, snapshot: snapshotWith('note-1') }
      return { ok: true } as never
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('возвращает список, даже если до закрытия была открыта карточка', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.selectNote('note-1')
    })
    expect(result.current.mode).toBe('properties')

    act(() => {
      notifyOpened()
    })

    expect(result.current.mode).toBe('list')
    expect(result.current.selectedId).toBeNull()
  })

  it('не оставляет панель пустой, если выбранной заметки больше нет', async () => {
    const sendMessage = vi.mocked(browser.runtime.sendMessage)
    sendMessage.mockImplementation(async (message: unknown) => {
      const action = (message as { action?: string }).action
      if (action === 'NOTES_LOAD') return { ok: true, snapshot: snapshotWith('note-1') }
      return { ok: true } as never
    })

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.selectNote('note-1')
    })
    expect(result.current.selectedNote).not.toBeNull()

    // Заметку удалили на другом устройстве: свежий снимок её не содержит.
    sendMessage.mockImplementation(async (message: unknown) => {
      const action = (message as { action?: string }).action
      if (action === 'NOTES_LOAD') return { ok: true, snapshot: snapshotWith('note-2') }
      return { ok: true } as never
    })

    act(() => {
      notifyOpened()
    })

    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(result.current.mode).toBe('list')
    expect(result.current.selectedNote).toBeNull()
  })
})
