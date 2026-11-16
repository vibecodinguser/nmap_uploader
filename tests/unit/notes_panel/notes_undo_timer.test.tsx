// @vitest-environment happy-dom

/**
 * Тост «Отменить» принадлежит последнему удалению.
 *
 * Таймер первого удаления не должен гасить тост второго: иначе отменить
 * только что удалённую заметку невозможно — кнопка исчезает раньше срока.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { NOTES_LOAD_ACTION, type NotesSnapshot } from '@/lib/notes/protocol'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'
import { sampleNote } from '@/tests/unit/notes_panel/list_props'

const geometry = { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] }

const snapshot: NotesSnapshot = {
  manifest: {
    version: 1,
    updatedAt: '2026-11-14T10:00:00.000Z',
    groups: [],
    notes: [
      sampleNote({ id: 'note-1', name: 'Первая' }),
      sampleNote({ id: 'note-2', name: 'Вторая' }),
    ],
  },
  shards: {
    '2026-11': {
      version: 1,
      updatedAt: '2026-11-14T10:00:00.000Z',
      notes: { 'note-1': geometry, 'note-2': geometry },
    },
  },
  hiddenIds: [],
}

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

describe('undo принадлежит последнему удалению', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    // Время идёт, чтобы `waitFor` работал, а прыжки мы делаем сами.
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 20 })
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (message: {
      action?: string
    }) => {
      if (message.action === NOTES_LOAD_ACTION) return { ok: true, snapshot }
      return { ok: true, patch: { manifest: snapshot.manifest, shards: {} } }
    }) as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('второе удаление получает полные пять секунд', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.removeNote('note-1')
    })
    expect(result.current.undo?.note.id).toBe('note-1')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    act(() => {
      result.current.removeNote('note-2')
    })
    expect(result.current.undo?.note.id).toBe('note-2')

    // Прошло 4.5 с после второго удаления: таймер первого уже истёк, второго — нет.
    act(() => {
      vi.advanceTimersByTime(4500)
    })
    expect(result.current.undo?.note.id).toBe('note-2')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.undo).toBeNull()
    expect(result.current.notes.map((note) => note.id)).toEqual([])
  })

  it('возврат заметки закрывает тост сразу', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.removeNote('note-1')
    })
    act(() => {
      result.current.undoRemove()
    })

    expect(result.current.undo).toBeNull()
    expect(result.current.notes.map((note) => note.id)).toContain('note-1')

    // Таймер отменён: через пять секунд тост не вернётся и выбор не сбросится.
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.notes.map((note) => note.id)).toContain('note-1')
  })
})
