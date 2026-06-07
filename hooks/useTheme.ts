import { useCallback, useEffect, useState } from 'react'
import { applyBrowserThemeVars } from '@/lib/browser_theme'

export type Theme = 'light' | 'dark'
export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

export const getSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const getStoredThemeMode = (): ThemeMode => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export const resolveTheme = (mode: ThemeMode): Theme =>
  mode === 'system' ? getSystemTheme() : mode

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
    localStorage.setItem(STORAGE_KEY, themeMode)
  }, [themeMode, resolvedTheme, themeTarget])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
  }, [])

  return { themeMode, setThemeMode }
}
