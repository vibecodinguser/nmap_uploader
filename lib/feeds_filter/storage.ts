import { browser } from 'wxt/browser'

export const FEEDS_FILTER_ENABLED_STORAGE_KEY = 'feeds_filter_enabled'

/**
 * Возвращает сохраненное состояние активности фильтра истории правок (по умолчанию выключен).
 */
export const getStoredFeedsFilterEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(FEEDS_FILTER_ENABLED_STORAGE_KEY)
  const value = stored[FEEDS_FILTER_ENABLED_STORAGE_KEY]
  return value === undefined ? false : Boolean(value)
}

/**
 * Сохраняет состояние активности фильтра истории правок в хранилище браузера.
 */
export const setStoredFeedsFilterEnabled = async (enabled: boolean): Promise<void> => {
  await browser.storage.local.set({ [FEEDS_FILTER_ENABLED_STORAGE_KEY]: enabled })
}
