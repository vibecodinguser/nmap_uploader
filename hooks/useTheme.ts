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

function readInitialThemeMode(): ThemeMode {
  return getStoredThemeMode()
}

function readInitialSystemTheme(): Theme {
  return getSystemTheme()
}

function readCurrentSystemTheme(): Theme {
  return getSystemTheme()
}

function applyThemeClass(themeTarget: Element | undefined, isDark: boolean): void {
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

function resolveHookTheme(themeMode: ThemeMode, systemTheme: Theme): Theme {
  let result: Theme
  if (themeMode === 'system') {
    result = systemTheme
  } else {
    result = themeMode
  }
  return result
}

function refreshSystemTheme(setSystemTheme: (theme: Theme) => void): void {
  const nextTheme = readCurrentSystemTheme()
  setSystemTheme(nextTheme)
}

function onSystemThemeChange(setSystemTheme: (theme: Theme) => void): void {
  refreshSystemTheme(setSystemTheme)
}

function unsubscribeSystemTheme(mediaQuery: MediaQueryList, handler: () => void): void {
  mediaQuery.removeEventListener('change', handler)
}

function subscribeSystemTheme(setSystemTheme: (theme: Theme) => void): () => void {
  refreshSystemTheme(setSystemTheme)

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = onSystemThemeChange.bind(undefined, setSystemTheme)
  mediaQuery.addEventListener('change', handleChange)
  return unsubscribeSystemTheme.bind(undefined, mediaQuery, handleChange)
}

function noopCleanup(): void {
  // Cleanup placeholder when theme mode is not system.
}

function runSystemThemeEffect(
  themeMode: ThemeMode,
  setSystemTheme: (theme: Theme) => void,
): () => void {
  let cleanup: () => void = noopCleanup
  if (themeMode === 'system') {
    cleanup = subscribeSystemTheme(setSystemTheme)
  }
  return cleanup
}

function onThemeStorageSyncError(error: unknown): void {
  console.warn('[nmap_uploader] theme storage sync failed:', error)
}

function handleThemeStorageSyncTask(task: Promise<void>): void {
  task.catch(onThemeStorageSyncError)
}

function syncThemePreferences(
  themeTarget: Element | undefined,
  themeMode: ThemeMode,
  resolvedTheme: Theme,
): void {
  applyThemeClass(themeTarget, resolvedTheme === 'dark')
  localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  const saveTask = setStoredExtensionThemeMode(themeMode)
  handleThemeStorageSyncTask(saveTask)
}

export const useTheme = (themeTarget?: Element) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readInitialThemeMode)
  const [systemTheme, setSystemTheme] = useState<Theme>(readInitialSystemTheme)

  const resolvedTheme = resolveHookTheme(themeMode, systemTheme)

  useEffect(
    function subscribeSystemThemeChanges(): () => void {
      return runSystemThemeEffect(themeMode, setSystemTheme)
    },
    [themeMode],
  )

  useEffect(
    function syncThemeEffect(): void {
      syncThemePreferences(themeTarget, themeMode, resolvedTheme)
    },
    [themeMode, resolvedTheme, themeTarget],
  )

  const setThemeMode = useCallback(function setThemeMode(mode: ThemeMode): void {
    setThemeModeState(mode)
  }, [])

  return { themeMode, setThemeMode }
}
