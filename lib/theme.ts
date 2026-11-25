export type Theme = 'light' | 'dark'

export const getSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

let nativeThemeState: Theme | null = null
const nativeThemeListeners = new Set<(theme: Theme) => void>()

/** Тема нативного редактора, полученная из iframe-моста. */
export const setNativeTheme = (theme: Theme): void => {
  if (nativeThemeState === theme) return
  nativeThemeState = theme
  for (const listener of nativeThemeListeners) listener(theme)
}

/**
 * Последняя известная тема редактора; пока мост не сообщил её (или за его
 * пределами) — системная тема.
 */
export const getNativeThemeSnapshot = (): Theme => nativeThemeState ?? getSystemTheme()

export const subscribeNativeTheme = (listener: (theme: Theme) => void): (() => void) => {
  nativeThemeListeners.add(listener)
  return () => {
    nativeThemeListeners.delete(listener)
  }
}
