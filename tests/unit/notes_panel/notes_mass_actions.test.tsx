// @vitest-environment happy-dom

/**
 * Массовые действия: отметки и пачка.
 *
 * Главное, что проверяем, — пачка уходит одним сообщением: сто одиночных
 * сохранений были бы в сто раз дороже и оставляли бы промежуточные состояния
 * на Диске.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import {
  NOTES_DELETE_NOTES_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_MOVE_NOTES_ACTION,
  type NotesSnapshot,
} from '@/lib/notes/protocol'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

const geometry = { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] }

const snapshot: NotesSnapshot = {
  manifest: {
    version: 1,
    updatedAt: '2026-11-16T10:00:00.000Z',
    groups: [sampleGroup()],
    notes: [
      sampleNote({ id: 'note-1', name: 'Первая' }),
      sampleNote({ id: 'note-2', name: 'Вторая' }),
      sampleNote({ id: 'note-3', name: 'Третья' }),
    ],
  },
  shards: {
    '2026-11': {
      version: 1,
      updatedAt: '2026-11-16T10:00:00.000Z',
      notes: { 'note-1': geometry, 'note-2': geometry, 'note-3': geometry },
    },
  },
  hiddenIds: [],
}

const renderPanel = () =>
  renderHook(() => useNotesPanel(), {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
  })

describe('отметки заметок', () => {
  let sent: Array<Record<string, unknown>> = []

  beforeEach(async () => {
    await resetBrowserMocks()
    sent = []
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (
      message: Record<string, unknown>,
    ) => {
      sent.push(message)
      if (message.action === NOTES_LOAD_ACTION) return { ok: true, snapshot }
      return { ok: true, patch: { manifest: snapshot.manifest, shards: {} } }
    }) as never)
  })

  const ready = async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    return result
  }

  it('отмечает и снимает отметку', async () => {
    const result = await ready()

    act(() => {
      result.current.toggleChecked('note-1', true)
      result.current.toggleChecked('note-2', true)
    })
    expect(result.current.checkedIds.sort()).toEqual(['note-1', 'note-2'])

    act(() => {
      result.current.toggleChecked('note-1', false)
    })
    expect(result.current.checkedIds).toEqual(['note-2'])
  })

  it('повторная отметка не дублирует id', async () => {
    const result = await ready()

    act(() => {
      result.current.toggleChecked('note-1', true)
      result.current.toggleChecked('note-1', true)
    })

    expect(result.current.checkedIds).toEqual(['note-1'])
  })

  it('«отметить все» берёт только переданные заметки', async () => {
    const result = await ready()

    act(() => {
      result.current.checkAllVisible(['note-1', 'note-3'])
    })

    expect(result.current.checkedIds.sort()).toEqual(['note-1', 'note-3'])
  })

  it('снятие отметок очищает список', async () => {
    const result = await ready()

    act(() => {
      result.current.toggleChecked('note-1', true)
      result.current.clearChecked()
    })

    expect(result.current.checkedIds).toEqual([])
  })
})

describe('удаление отмеченных', () => {
  let sent: Array<Record<string, unknown>> = []

  beforeEach(async () => {
    await resetBrowserMocks()
    sent = []
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (
      message: Record<string, unknown>,
    ) => {
      sent.push(message)
      if (message.action === NOTES_LOAD_ACTION) return { ok: true, snapshot }
      if (message.action === NOTES_DELETE_NOTES_ACTION) {
        const ids = new Set(message.noteIds as string[])
        return {
          ok: true,
          patch: {
            manifest: {
              ...snapshot.manifest,
              notes: snapshot.manifest.notes.filter((note) => !ids.has(note.id)),
            },
            shards: {},
          },
        }
      }
      return { ok: true, patch: { manifest: snapshot.manifest, shards: {} } }
    }) as never)
  })

  const ready = async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    return result
  }

  it('уходит одним сообщением, а не по одному на заметку', async () => {
    const result = await ready()

    act(() => {
      result.current.checkAllVisible(['note-1', 'note-2'])
    })
    act(() => {
      result.current.deleteChecked()
    })

    await waitFor(() =>
      expect(sent.filter((message) => message.action === NOTES_DELETE_NOTES_ACTION)).toHaveLength(
        1,
      ),
    )
    const batch = sent.find((message) => message.action === NOTES_DELETE_NOTES_ACTION)
    expect(batch?.noteIds).toEqual(['note-1', 'note-2'])
    // Одиночных удалений быть не должно.
    expect(sent.some((message) => message.action === 'NOTES_DELETE_NOTE')).toBe(false)
  })

  it('список обновляется сразу, не дожидаясь Диска', async () => {
    const result = await ready()

    act(() => {
      result.current.checkAllVisible(['note-1'])
    })
    act(() => {
      result.current.deleteChecked()
    })

    expect(result.current.notes.map((note) => note.id).sort()).toEqual(['note-2', 'note-3'])
    expect(result.current.checkedIds).toEqual([])
  })

  it('пустой набор ничего не отправляет', async () => {
    const result = await ready()

    act(() => {
      result.current.deleteChecked()
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(sent.some((message) => message.action === NOTES_DELETE_NOTES_ACTION)).toBe(false)
  })
})

describe('перенос отмеченных', () => {
  let sent: Array<Record<string, unknown>> = []

  beforeEach(async () => {
    await resetBrowserMocks()
    sent = []
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (
      message: Record<string, unknown>,
    ) => {
      sent.push(message)
      if (message.action === NOTES_LOAD_ACTION) return { ok: true, snapshot }
      return { ok: true, patch: { manifest: snapshot.manifest, shards: {} } }
    }) as never)
  })

  it('переносит пачку одним сообщением с группой', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.checkAllVisible(['note-1', 'note-3'])
    })
    act(() => {
      result.current.moveCheckedToGroup('group-1')
    })

    await waitFor(() =>
      expect(sent.filter((message) => message.action === NOTES_MOVE_NOTES_ACTION)).toHaveLength(1),
    )
    const batch = sent.find((message) => message.action === NOTES_MOVE_NOTES_ACTION)
    expect(batch?.noteIds).toEqual(['note-1', 'note-3'])
    expect(batch?.groupId).toBe('group-1')
  })

  it('обновляет группу у отмеченных в состоянии сразу', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.checkAllVisible(['note-1'])
    })
    act(() => {
      result.current.moveCheckedToGroup('group-1')
    })

    expect(result.current.notes.find((note) => note.id === 'note-1')?.groupId).toBe('group-1')
    // Неотмеченные не тронуты.
    expect(result.current.notes.find((note) => note.id === 'note-2')?.groupId).toBeNull()
  })
})
