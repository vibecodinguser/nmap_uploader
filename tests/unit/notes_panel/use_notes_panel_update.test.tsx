// @vitest-environment happy-dom

/**
 * Characterization-тесты правки и удаления заметки в панели.
 *
 * Дебаунс, очередь отправки и откат живут только в `useNotesPanel` и до сих
 * пор не были покрыты: переписать их, не зафиксировав текущее поведение,
 * значило бы гадать, что из этого контракт, а что дефект.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import {
  NOTES_DELETE_NOTE_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_SAVE_NOTE_ACTION,
} from '@/lib/notes/messages'
import type { Note } from '@/lib/notes/types'
import { sampleNote } from '@/tests/unit/notes_panel/list_props'

const geometry = { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] }

/**
 * Снимок: две заметки с геометрией и одна без неё.
 *
 * Третья заметка нужна для проверки панели без загруженного шарда.
 */
const snapshot = {
  manifest: {
    version: 1,
    updatedAt: '2026-11-14T10:00:00.000Z',
    groups: [],
    notes: [
      sampleNote({ id: 'note-1', name: 'Первая' }),
      sampleNote({ id: 'note-2', name: 'Вторая' }),
      sampleNote({ id: 'note-3', name: 'Без геометрии' }),
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
  fromCache: false,
}

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

const nameOf = (notes: Array<{ id: string; name: string }>, id: string): string | undefined =>
  notes.find((note) => note.id === id)?.name

describe('useNotesPanel: правка заметки', () => {
  let sent: Array<Record<string, unknown>> = []

  const saves = (): Note[] =>
    sent
      .filter((message) => message.action === NOTES_SAVE_NOTE_ACTION)
      .map((message) => message.note as Note)

  beforeEach(() => {
    vi.restoreAllMocks()
    sent = []

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (
      message: Record<string, unknown>,
    ) => {
      sent.push(message)
      if (message.action === NOTES_LOAD_ACTION) return { ok: true, snapshot }
      return { ok: true }
    }) as never)
  })

  it('показывает правку сразу, а на Диск отправляет одну запись после паузы', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.updateNote('note-1', { name: 'Первый' })
      result.current.updateNote('note-1', { name: 'Второй' })
    })

    // Оптимистично: карта и список видят правку, не дожидаясь Диска.
    expect(nameOf(result.current.notes, 'note-1')).toBe('Второй')
    // Дебаунс: до истечения паузы записи ещё нет.
    expect(saves()).toHaveLength(0)

    await waitFor(() => expect(saves()).toHaveLength(1), { timeout: 3000 })
    expect(saves()[0]).toMatchObject({ id: 'note-1', name: 'Второй' })
  })

  it('при быстрой правке двух разных заметок сохраняет только последнюю (известный дефект)', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.updateNote('note-1', { name: 'Правка первой' })
      result.current.updateNote('note-2', { name: 'Правка второй' })
    })

    await waitFor(() => expect(saves()).toHaveLength(1), { timeout: 3000 })
    // Отложенная правка хранится в одном слоте, а обе правки посчитаны от
    // одного и того же снимка: правка первой заметки не попала ни на Диск,
    // ни в состояние панели — она просто исчезла.
    expect(saves().map((note) => note.id)).toEqual(['note-2'])
    expect(nameOf(result.current.notes, 'note-1')).toBe('Первая')
  })

  it('записывает отложенную правку при закрытии панели', async () => {
    const { result, unmount } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.updateNote('note-2', { name: 'Перед закрытием' })
    })
    expect(saves()).toHaveLength(0)

    unmount()

    await waitFor(() => expect(saves()).toHaveLength(1))
    expect(saves()[0]).toMatchObject({ id: 'note-2', name: 'Перед закрытием' })
  })

  it('не правит заметку без загруженной геометрии и молчит об этом', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.updateNote('note-3', { name: 'Новое имя' })
    })

    await new Promise((resolve) => setTimeout(resolve, 800))
    expect(saves()).toHaveLength(0)
    expect(nameOf(result.current.notes, 'note-3')).toBe('Без геометрии')
  })
})

describe('useNotesPanel: удаление и отмена', () => {
  let sent: Array<Record<string, unknown>> = []

  const actions = (): string[] => sent.map((message) => message.action as string)

  beforeEach(() => {
    vi.restoreAllMocks()
    sent = []

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (
      message: Record<string, unknown>,
    ) => {
      sent.push(message)
      if (message.action === NOTES_LOAD_ACTION) return { ok: true, snapshot }
      return { ok: true }
    }) as never)
  })

  it('убирает строку сразу, запоминает её для отмены и возвращает обратно', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.removeNote('note-1')
    })

    expect(result.current.notes.map((note) => note.id)).not.toContain('note-1')
    expect(result.current.undo?.note.id).toBe('note-1')
    await waitFor(() => expect(actions()).toContain(NOTES_DELETE_NOTE_ACTION))

    act(() => {
      result.current.undoRemove()
    })

    expect(result.current.notes.map((note) => note.id)).toContain('note-1')
    expect(result.current.undo).toBeNull()
    await waitFor(() =>
      expect(
        sent.some(
          (message) =>
            message.action === NOTES_SAVE_NOTE_ACTION && (message.note as Note).id === 'note-1',
        ),
      ).toBe(true),
    )
  })

  it('не удаляет заметку без загруженной геометрии', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.removeNote('note-3')
    })

    expect(result.current.notes.map((note) => note.id)).toContain('note-3')
    expect(actions()).not.toContain(NOTES_DELETE_NOTE_ACTION)
  })
})
