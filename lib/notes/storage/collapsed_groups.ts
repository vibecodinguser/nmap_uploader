import { browser } from 'wxt/browser'

/**
 * Свёрнутость групп в списке.
 *
 * Это состояние вида, а не данных: на Диск оно не уезжает и между устройствами
 * не синхронизируется. Хранится в `storage.local` — рядом со скрытыми id, по
 * тому же образцу.
 *
 * Ключ группы — её id, а у корня («Без группы») — пустая строка (см.
 * `collapseKey`). Свёрнутость корня тоже запоминается: иначе после перезапуска
 * он раскрывался бы и выталкивал группы вниз.
 */
export const COLLAPSED_GROUPS_STORAGE_KEY = 'notes_collapsed_groups'

export const readCollapsedGroupKeys = async (): Promise<string[]> => {
  const stored = await browser.storage.local.get(COLLAPSED_GROUPS_STORAGE_KEY)
  const value = stored[COLLAPSED_GROUPS_STORAGE_KEY]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((key): key is string => typeof key === 'string')
}

export const writeCollapsedGroupKeys = async (keys: readonly string[]): Promise<void> => {
  await browser.storage.local.set({ [COLLAPSED_GROUPS_STORAGE_KEY]: [...keys] })
}
