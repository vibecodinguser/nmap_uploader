import { useCallback, useEffect, useState } from 'react'
import { applyBrowserThemeVars } from '@/lib/browser_theme'
import {
  getStoredThemeMode,
  getSystemTheme,
  setStoredExtensionThemeMode,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemeMode,
} from '@/lib/theme'

export type { Theme, ThemeMode } from '@/lib/theme'

const applyThemeClass = (themeTarget: Element | undefined, isDark: boolean) => {
  const el = themeTarget ?? document.documentElement
  el.classList.toggle('dark', isDark)

  if (el instanceof HTMLElement) {
    applyBrowserThemeVars(el, isDark)
  }

  const root = el.getRootNode()
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    root.host.classList.toggle('dark', isDark)
    applyBrowserThemeVars(root.host, isDark)
  }
}

export const useTheme = (themeTarget?: Element) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode())
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme())

  const resolvedTheme: Theme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    if (themeMode !== 'system') return

    setSystemTheme(getSystemTheme())

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setSystemTheme(getSystemTheme())
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  useEffect(() => {
    applyThemeClass(themeTarget, resolvedTheme === 'dark')
    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    void setStoredExtensionThemeMode(themeMode).catch((error: unknown) => {
      console.warn('[nmap_uploader] theme storage sync failed:', error)
    })
  }, [themeMode, resolvedTheme, themeTarget])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
  }, [])

  return { themeMode, setThemeMode }
}
