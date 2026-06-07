import { getStoredThemeMode, resolveTheme } from '@/hooks/useTheme'
import { applyBrowserThemeVars } from '@/lib/browser_theme'

/** Применяет сохранённую тему к элементу и shadow host при первом mount. */
export const applyStoredDarkTheme = (themeTarget: HTMLElement): void => {
  const isDark = resolveTheme(getStoredThemeMode()) === 'dark'

  if (isDark) {
    themeTarget.classList.add('dark')
  }

  applyBrowserThemeVars(themeTarget, isDark)

  const root = themeTarget.getRootNode()
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    if (isDark) {
      root.host.classList.add('dark')
    }
    applyBrowserThemeVars(root.host, isDark)
  }
}
