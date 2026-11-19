// @vitest-environment happy-dom

/**
 * Свёрнутость групп переживает перезапуск панели.
 *
 * Проверяем именно поведение, а не запись в хранилище: панель открывается с
 * теми группами свёрнутыми, которые были свёрнуты в прошлый раз, а переключение
 * тут же уходит в `storage.local`.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { COLLAPSED_GROUPS_STORAGE_KEY } from '@/lib/notes/storage/collapsed_groups'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const group = (id: string, name: string, order: number) => ({
  id,
  name,
  color: '#1a8cff',
  order,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
})

const snapshot = {
  manifest: {
    version: 2,
    updatedAt: '2026-11-14T10:00:00.000Z',
    groups: [group('g1', 'Мосты', 0), group('g2', 'Причалы', 1)],
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

const readStored = async (): Promise<unknown> => {
  const stored = await browser.storage.local.get(COLLAPSED_GROUPS_STORAGE_KEY)
  return stored[COLLAPSED_GROUPS_STORAGE_KEY]
}

describe('свёрнутость групп', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((() =>
      Promise.resolve({ ok: true, snapshot })) as never)
  })

  it('при запуске восстанавливает свёрнутые группы', async () => {
    await browser.storage.local.set({ [COLLAPSED_GROUPS_STORAGE_KEY]: ['g2'] })

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.collapsedGroupIds).toEqual(['g2'])
  })

  it('запоминает свёрнутую группу', async () => {
    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.toggleGroupCollapsed('g1')
    })

    await waitFor(async () => expect(await readStored()).toEqual(['g1']))
  })

  it('запоминает и развёрнутую обратно', async () => {
    await browser.storage.local.set({ [COLLAPSED_GROUPS_STORAGE_KEY]: ['g1'] })

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.toggleGroupCollapsed('g1')
    })

    await waitFor(async () => expect(await readStored()).toEqual([]))
  })

  it('не держит в настройках id удалённой группы', async () => {
    // Ключ остался от прошлого сеанса, а группы с таким id уже нет.
    await browser.storage.local.set({ [COLLAPSED_GROUPS_STORAGE_KEY]: ['g9', 'g1'] })

    const { result } = renderPanel()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.toggleGroupCollapsed('g2')
    })

    await waitFor(async () => expect(await readStored()).toEqual(['g1', 'g2']))
  })
})
