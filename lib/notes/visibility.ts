import { browser } from 'wxt/browser'

/**
 * Скрытые заметки.
 *
 * Скрытие — режим просмотра «у меня сейчас», а не свойство заметки: оно живёт
 * локально и не синхронизируется между устройствами. Ключ сохранён прежним,
 * чтобы после обновления расширения скрытые объекты остались скрытыми.
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

/** Скрыть или показать сразу набор заметок (группа, результат поиска). */
export const setNotesHidden = (
  ids: readonly string[],
  targets: readonly string[],
  hidden: boolean,
): string[] => {
  const next = new Set(ids)
  for (const id of targets) {
    if (hidden) next.add(id)
    else next.delete(id)
  }
  return [...next]
}
