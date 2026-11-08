import { browser } from 'wxt/browser'

/**
 * Скрытые объекты заметок.
 *
 * Состояние живёт в `storage.local`, поэтому переживает закрытие попапа и
 * применяется на карте при следующей отрисовке.
 */
export const HIDDEN_NOTE_IDS_STORAGE_KEY = 'notes_hidden_ids'

export const readHiddenNoteIds = async (): Promise<string[]> => {
  const stored = await browser.storage.local.get(HIDDEN_NOTE_IDS_STORAGE_KEY)
  const value = stored[HIDDEN_NOTE_IDS_STORAGE_KEY]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((id): id is string => typeof id === 'string')
}

export const writeHiddenNoteIds = async (ids: string[]): Promise<void> => {
  await browser.storage.local.set({ [HIDDEN_NOTE_IDS_STORAGE_KEY]: ids })
}

export const toggleHiddenNoteId = (ids: readonly string[], id: string): string[] => {
  const next = new Set(ids)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return [...next]
}
