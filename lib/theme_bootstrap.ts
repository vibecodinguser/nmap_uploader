import { getStoredThemeMode, resolveTheme } from '@/hooks/useTheme'
import { applyBrowserDarkThemeVars } from '@/lib/browser_theme'

/** Применяет сохранённую тёмную тему к элементу и shadow host при первом mount. */
export const applyStoredDarkTheme = (themeTarget: HTMLElement): void => {
  if (resolveTheme(getStoredThemeMode()) !== 'dark') return

  themeTarget.classList.add('dark')
  applyBrowserDarkThemeVars(themeTarget, true)

  const root = themeTarget.getRootNode()
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    root.host.classList.add('dark')
    applyBrowserDarkThemeVars(root.host, true)
  }
}
