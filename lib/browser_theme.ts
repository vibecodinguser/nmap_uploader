import { isYandexBrowser } from './browser'

const CHROME_DARK_SURFACE = '#3c3c3c'

const CHROME_DARK_SURFACE_VARS = {
  '--dark-surface': CHROME_DARK_SURFACE,
  '--dark-header-bg': CHROME_DARK_SURFACE,
  '--dark-header-bg-blur': CHROME_DARK_SURFACE,
} as const

const DARK_SURFACE_VAR_KEYS = Object.keys(CHROME_DARK_SURFACE_VARS)

/** Применяет цвета тёмной темы с учётом браузера (Chrome / Yandex). */
export const applyBrowserDarkThemeVars = (el: HTMLElement, isDark: boolean): void => {
  for (const key of DARK_SURFACE_VAR_KEYS) {
    el.style.removeProperty(key)
  }

  if (!isDark || isYandexBrowser()) return

  for (const [key, value] of Object.entries(CHROME_DARK_SURFACE_VARS)) {
    el.style.setProperty(key, value)
  }
}
