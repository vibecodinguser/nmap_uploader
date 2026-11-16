// @vitest-environment happy-dom

/**
 * «Найти на карте» — навигация, а не редактирование.
 *
 * Раньше кнопка вдобавок выбирала заметку, и панель переключалась на свойства:
 * вместо того чтобы показать объект, она открывала его на правку.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { createDefaultStyle } from '@/lib/notes/model/style_resolution'
import type { Note } from '@/lib/notes/model/types'
import { NOTES_SELECT_ACTION } from '@/lib/notes/protocol'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const note: Note = {
  id: 'note-1',
  kind: 'Point',
  name: '14.11.2026 Точка',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: createDefaultStyle('Point'),
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
}

const snapshot = {
  manifest: {
    version: 1,
    updatedAt: '2026-11-14T10:00:00.000Z',
    groups: [],
    notes: [note],
  },
  shards: {
    '2026-11': {
      version: 1,
      updatedAt: '2026-11-14T10:00:00.000Z',
      notes: { 'note-1': { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] } },
    },
  },
  hiddenIds: [],
}

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

describe('useNotesPanel: «Найти на карте»', () => {
  let sendMessage: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    await resetBrowserMocks()
    sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockResolvedValue({ ok: true, snapshot } as never)
  })

  it('центрирует карту на объекте', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.locateNote('note-1')
    })

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'centerMap', latitude: 55.7, longitude: 37.6 }),
    )
  })

  it('не выбирает заметку и не открывает свойства', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.locateNote('note-1')
    })

    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: NOTES_SELECT_ACTION }),
    )
    expect(result.current.mode).toBe('list')
    expect(result.current.selectedId).toBeNull()
  })

  it('выбор по клику в строке по-прежнему открывает свойства', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.selectNote('note-1')
    })

    expect(result.current.mode).toBe('properties')
    expect(result.current.selectedId).toBe('note-1')
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: NOTES_SELECT_ACTION, noteId: 'note-1' }),
    )
  })
})
