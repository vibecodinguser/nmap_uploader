// @vitest-environment happy-dom

/**
 * Имена новых групп.
 *
 * Группа создаётся кнопкой без диалога, поэтому имя подставляется целиком —
 * и повторное нажатие не должно давать два одинаковых названия: в списке их
 * было бы не отличить друг от друга.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const emptySnapshot = {
  manifest: {
    version: 2,
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

describe('имена новых групп', () => {
  /** Что «Диск» уже принял: ответ возвращает манифест с этими группами. */
  let saved: Array<{ id: string; name: string; color: string; order: number }>

  const manifestWith = () => ({ ...emptySnapshot.manifest, groups: saved })

  beforeEach(async () => {
    await resetBrowserMocks()
    saved = []

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((message: {
      action?: string
      group?: { id: string; name: string; color: string; order: number }
    }) => {
      if (message?.action === 'NOTES_SAVE_GROUP' && message.group) {
        saved = [...saved, message.group]
        return Promise.resolve({
          ok: true,
          patch: { manifest: manifestWith(), shards: {} },
        })
      }
      return Promise.resolve({ ok: true, snapshot: { ...emptySnapshot, manifest: manifestWith() } })
    }) as never)
  })

  const createTwice = async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.createGroup('Новая группа')
    })
    await waitFor(() => expect(result.current.groups).toHaveLength(1))

    act(() => {
      result.current.createGroup('Новая группа')
    })
    await waitFor(() => expect(result.current.groups).toHaveLength(2))

    return result.current.groups.map((group) => group.name)
  }

  it('второй раз добавляет номер, а не повторяет название', async () => {
    expect(await createTwice()).toEqual(['Новая группа', 'Новая группа 2'])
  })

  it('третий раз продолжает нумерацию', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    for (let index = 0; index < 3; index += 1) {
      act(() => {
        result.current.createGroup('Новая группа')
      })
      await waitFor(() => expect(result.current.groups).toHaveLength(index + 1))
    }

    expect(result.current.groups.map((group) => group.name)).toEqual([
      'Новая группа',
      'Новая группа 2',
      'Новая группа 3',
    ])
  })

  it('группу с другим именем не нумерует', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.createGroup('Мосты')
    })
    await waitFor(() => expect(result.current.groups).toHaveLength(1))

    act(() => {
      result.current.createGroup('Новая группа')
    })
    await waitFor(() => expect(result.current.groups).toHaveLength(2))

    expect(result.current.groups.map((group) => group.name)).toEqual(['Мосты', 'Новая группа'])
  })
})
