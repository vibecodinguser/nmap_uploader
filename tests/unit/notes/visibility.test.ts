// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import {
  HIDDEN_NOTE_IDS_STORAGE_KEY,
  readHiddenNoteIds,
  toggleHiddenNoteId,
  writeHiddenNoteIds,
} from '@/lib/notes/visibility'

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notes visibility storage', () => {
  it('читает только строковые id', async () => {
    ;(browser.storage.local.get as any).mockResolvedValue({
      [HIDDEN_NOTE_IDS_STORAGE_KEY]: ['a', 1, null, 'b'],
    })

    expect(await readHiddenNoteIds()).toEqual(['a', 'b'])
  })

  it('возвращает пустой список, если значения нет', async () => {
    ;(browser.storage.local.get as any).mockResolvedValue({})

    expect(await readHiddenNoteIds()).toEqual([])
  })

  it('пишет список в storage', async () => {
    await writeHiddenNoteIds(['a'])

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      [HIDDEN_NOTE_IDS_STORAGE_KEY]: ['a'],
    })
  })

  it('добавляет и убирает id при переключении', () => {
    expect(toggleHiddenNoteId([], 'a')).toEqual(['a'])
    expect(toggleHiddenNoteId(['a'], 'a')).toEqual([])
    expect(toggleHiddenNoteId(['a'], 'b')).toEqual(['a', 'b'])
  })
})
