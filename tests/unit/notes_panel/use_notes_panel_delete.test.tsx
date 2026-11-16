// @vitest-environment happy-dom

/**
 * Удаление заметки должно быть мгновенным для пользователя.
 *
 * Строка исчезает сразу, а не после ответа Яндекс.Диска: полный цикл записи —
 * это несколько сетевых round-trip, и ждать их в интерфейсе незачем.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { createDefaultStyle } from '@/lib/notes/model/style_resolution'
import type { Note } from '@/lib/notes/model/types'
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
      notes: { 'note-1': { kind: 'Point' as const, coords: [37, 55] as [number, number] } },
    },
  },
  hiddenIds: [],
}

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

describe('useNotesPanel: удаление', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('убирает строку сразу, не дожидаясь ответа Диска', async () => {
    let resolveDelete: (value: unknown) => void = () => {}
    const deletePending = new Promise((resolve) => {
      resolveDelete = resolve
    })

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((message: { action?: string }) => {
      if (message.action === 'NOTES_DELETE_NOTE') return deletePending as never
      return Promise.resolve({ ok: true, snapshot }) as never
    }) as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.removeNote('note-1')
    })

    // Ответа Диска ещё нет, а строки уже нет и «Отменить» доступна.
    expect(result.current.notes).toHaveLength(0)
    expect(result.current.undo?.note.id).toBe('note-1')

    await act(async () => {
      resolveDelete({
        ok: true,
        patch: { manifest: { ...snapshot.manifest, notes: [] }, shards: {} },
      })
      await deletePending
    })

    expect(result.current.notes).toHaveLength(0)
  })

  it('возвращает заметку, если сохранение не прошло', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((message: { action?: string }) => {
      if (message.action === 'NOTES_DELETE_NOTE') {
        return Promise.resolve({ ok: false, error: 'STORAGE_ERROR' }) as never
      }
      return Promise.resolve({ ok: true, snapshot }) as never
    }) as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    await act(async () => {
      result.current.removeNote('note-1')
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(result.current.undo).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('передаёт дату заметки, чтобы шард нашелся без чтения манифеста', async () => {
    const sendMessage = vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((message: {
      action?: string
    }) => {
      if (message.action === 'NOTES_DELETE_NOTE') {
        return Promise.resolve({
          ok: true,
          patch: { manifest: snapshot.manifest, shards: {} },
        }) as never
      }
      return Promise.resolve({ ok: true, snapshot }) as never
    }) as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.removeNote('note-1')
    })

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTES_DELETE_NOTE',
          noteId: 'note-1',
          date: '14-11-2026',
        }),
      ),
    )
  })
})
