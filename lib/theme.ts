import { browser } from 'wxt/browser'

export type Theme = 'light' | 'dark'
export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'theme'

export const getSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const normalizeThemeMode = (value: unknown): ThemeMode => {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

export const resolveTheme = (mode: ThemeMode): Theme =>
  mode === 'system' ? getSystemTheme() : mode

export const getStoredThemeMode = (): ThemeMode =>
  normalizeThemeMode(localStorage.getItem(THEME_STORAGE_KEY))

export const getStoredExtensionThemeMode = async (): Promise<ThemeMode> => {
  const stored = await browser.storage.local.get(THEME_STORAGE_KEY)
  return normalizeThemeMode(stored[THEME_STORAGE_KEY])
}

export const setStoredExtensionThemeMode = async (mode: ThemeMode): Promise<void> => {
  await browser.storage.local.set({ [THEME_STORAGE_KEY]: mode })
}

/**
 * Копирует тему из localStorage панели в storage для content scripts.
 *
 * Пишет только если в `localStorage` есть явный выбор: иначе страница, которая
 * никогда не выбирала тему, затирала бы сохранённое значение на `system` и
 * возвращала пользователя к системной теме каждый раз при открытии.
 */
export const syncThemeLocalToExtensionStorage = async (): Promise<void> => {
  const raw = localStorage.getItem(THEME_STORAGE_KEY)
  if (raw !== 'light' && raw !== 'dark' && raw !== 'system') return
  await setStoredExtensionThemeMode(raw)
}
