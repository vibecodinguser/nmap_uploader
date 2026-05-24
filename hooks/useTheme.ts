import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

const getSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const useTheme = (themeTarget?: Element) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored ?? getSystemTheme()
  })

  useEffect(() => {
    const el = themeTarget ?? document.documentElement
    const isDark = theme === 'dark'
    el.classList.toggle('dark', isDark)

    const root = el.getRootNode()
    if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
      root.host.classList.toggle('dark', isDark)
    }

    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, themeTarget])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
