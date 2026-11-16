// @vitest-environment happy-dom

/**
 * Ответ Диска на устаревшую запись не должен откатывать более свежую правку.
 *
 * Пользователь печатает в названии: дебаунс отправляет первую правку, вторая
 * набирается, пока первая в пути. Ответ на первую приходит позже второй правки
 * и несёт старое название — если применить его целиком, поле «прыгает» назад и
 * через секунду возвращается, когда доедет ответ на вторую.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { NOTES_LOAD_ACTION, NOTES_SAVE_NOTE_ACTION, type NotesSnapshot } from '@/lib/notes/protocol'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'
import { sampleNote } from '@/tests/unit/notes_panel/list_props'

const geometry = { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] }

const snapshot: NotesSnapshot = {
  manifest: {
    version: 1,
    updatedAt: '2026-11-16T10:00:00.000Z',
    groups: [],
    deletedNotes: [],
    notes: [sampleNote({ id: 'note-1', name: 'Первая' })],
  },
  shards: {
    '2026-11': {
      version: 1,
      updatedAt: '2026-11-16T10:00:00.000Z',
      notes: { 'note-1': geometry },
    },
  },
  hiddenIds: [],
}

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

describe('ответы Диска приходят не в том порядке', () => {
  let saves: Array<{ note: { id: string; name: string }; resolve: (value: unknown) => void }> = []

  beforeEach(async () => {
    await resetBrowserMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 20 })
    saves = []

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (message: {
      action?: string
      note?: { id: string; name: string }
    }) => {
      if (message.action === NOTES_LOAD_ACTION) return { ok: true, snapshot }
      if (message.action === NOTES_SAVE_NOTE_ACTION && message.note) {
        const note = message.note
        return new Promise((resolve) => {
          saves.push({ note, resolve })
        })
      }
      return { ok: true, patch: { manifest: snapshot.manifest, shards: {} } }
    }) as never)
  })

  it('устаревший ответ не откатывает только что набранное значение', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.updateNote('note-1', { name: 'А' })
    })
    // Дебаунс истёк: первая правка ушла на Диск и ждёт ответа.
    await waitFor(() => expect(saves).toHaveLength(1), { timeout: 3000 })

    // Пока ответа нет, пользователь печатает дальше.
    act(() => {
      result.current.updateNote('note-1', { name: 'АБ' })
    })
    expect(result.current.notes[0]?.name).toBe('АБ')

    // Ответ на первую правку приходит со старым названием.
    await act(async () => {
      saves[0]?.resolve({
        ok: true,
        patch: {
          manifest: {
            ...snapshot.manifest,
            notes: [sampleNote({ id: 'note-1', name: 'А' })],
          },
          shards: {},
        },
      })
      await Promise.resolve()
    })

    expect(result.current.notes[0]?.name).toBe('АБ')
  })

  it('после всех ответов остаётся последнее набранное значение', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.updateNote('note-1', { name: 'А' })
    })
    await waitFor(() => expect(saves).toHaveLength(1), { timeout: 3000 })

    act(() => {
      result.current.updateNote('note-1', { name: 'АБ' })
    })

    // Очередь записи сериализована: вторая правка уйдёт только после ответа
    // на первую — параллельные записи одного файла дают `423 LOCKED`.
    expect(saves).toHaveLength(1)

    await act(async () => {
      saves[0]?.resolve({
        ok: true,
        patch: {
          manifest: { ...snapshot.manifest, notes: [sampleNote({ id: 'note-1', name: 'А' })] },
          shards: {},
        },
      })
      await Promise.resolve()
    })
    expect(result.current.notes[0]?.name).toBe('АБ')

    await waitFor(() => expect(saves).toHaveLength(2), { timeout: 3000 })
    expect(saves[1]?.note.name).toBe('АБ')

    await act(async () => {
      saves[1]?.resolve({
        ok: true,
        patch: {
          manifest: { ...snapshot.manifest, notes: [sampleNote({ id: 'note-1', name: 'АБ' })] },
          shards: {},
        },
      })
      await Promise.resolve()
    })

    expect(result.current.notes[0]?.name).toBe('АБ')
  })

  it('ответ на сохранение другой заметки не откатывает правку текущей', async () => {
    const twoNotes: NotesSnapshot = {
      ...snapshot,
      manifest: {
        ...snapshot.manifest,
        notes: [
          sampleNote({ id: 'note-1', name: 'Первая' }),
          sampleNote({ id: 'note-2', name: 'Вторая' }),
        ],
      },
      shards: {
        '2026-11': {
          version: 1,
          updatedAt: '2026-11-16T10:00:00.000Z',
          notes: { 'note-1': geometry, 'note-2': geometry },
        },
      },
    }

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (message: {
      action?: string
      note?: { id: string; name: string }
    }) => {
      if (message.action === NOTES_LOAD_ACTION) return { ok: true, snapshot: twoNotes }
      if (message.action === NOTES_SAVE_NOTE_ACTION && message.note) {
        const note = message.note
        return new Promise((resolve) => {
          saves.push({ note, resolve })
        })
      }
      return { ok: true, patch: { manifest: twoNotes.manifest, shards: {} } }
    }) as never)

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.updateNote('note-2', { name: 'Вторая правка' })
    })
    await waitFor(() => expect(saves).toHaveLength(1), { timeout: 3000 })

    act(() => {
      result.current.updateNote('note-1', { name: 'Первая правка' })
    })

    await act(async () => {
      saves[0]?.resolve({
        ok: true,
        patch: { manifest: twoNotes.manifest, shards: {} },
      })
      await Promise.resolve()
    })

    // Правка первой заметки ещё не ушла на Диск, но уже видна и не откатилась.
    expect(result.current.notes.find((note) => note.id === 'note-1')?.name).toBe('Первая правка')
  })
})
