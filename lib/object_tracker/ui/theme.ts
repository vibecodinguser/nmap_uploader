import { browser } from 'wxt/browser'
import {
  getStoredExtensionThemeMode,
  getSystemTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemeMode,
} from '@/lib/theme'

/** Палитра панели наблюдения. Значения подставляются в CSS-переменные. */
export interface TrackerPalette {
  background: string
  foreground: string
  muted: string
  border: string
  cardBackground: string
  cardBorder: string
  link: string
  accent: string
  accentForeground: string
  inputBackground: string
  hover: string
  selectedBackground: string
  warningBackground: string
  warningForeground: string
  error: string
  newBackground: string
  newBorder: string
  statusPublishedBackground: string
  statusPublishedForeground: string
  statusPendingBackground: string
  statusPendingForeground: string
  statusRejectedBackground: string
  statusRejectedForeground: string
}

/** Светлая тема повторяет палитру островного интерфейса редактора. */
export const TRACKER_PALETTE_LIGHT: TrackerPalette = {
  background: '#ffffff',
  foreground: '#000000',
  muted: '#666666',
  border: 'rgba(0, 0, 0, 0.14)',
  cardBackground: '#ffffff',
  cardBorder: 'rgba(0, 0, 0, 0.1)',
  link: '#0055cc',
  accent: '#ffdb4d',
  accentForeground: '#000000',
  inputBackground: '#ffffff',
  hover: 'rgba(0, 0, 0, 0.05)',
  selectedBackground: 'rgba(0, 0, 0, 0.07)',
  warningBackground: '#fff4c2',
  warningForeground: '#6b4d00',
  error: '#cc0000',
  newBackground: '#fffdf2',
  newBorder: '#ffdb4d',
  statusPublishedBackground: '#e5f5df',
  statusPublishedForeground: '#2c6b1c',
  statusPendingBackground: '#fff3cd',
  statusPendingForeground: '#7a5b00',
  statusRejectedBackground: '#fde2e2',
  statusRejectedForeground: '#9b1c1c',
}

/** Тёмная тема совпадает с тёмной поверхностью редактора (#45464f). */
export const TRACKER_PALETTE_DARK: TrackerPalette = {
  background: '#45464f',
  foreground: '#ededed',
  muted: '#a3a3ad',
  border: 'rgba(255, 255, 255, 0.18)',
  cardBackground: 'rgba(255, 255, 255, 0.06)',
  cardBorder: 'rgba(255, 255, 255, 0.12)',
  link: '#8ab4ff',
  accent: '#ffdb4d',
  accentForeground: '#000000',
  inputBackground: 'rgba(255, 255, 255, 0.1)',
  hover: 'rgba(255, 255, 255, 0.08)',
  selectedBackground: 'rgba(255, 255, 255, 0.14)',
  warningBackground: 'rgba(255, 219, 77, 0.16)',
  warningForeground: '#ffd76e',
  error: '#ff8080',
  newBackground: 'rgba(255, 219, 77, 0.1)',
  newBorder: 'rgba(255, 219, 77, 0.55)',
  statusPublishedBackground: 'rgba(143, 203, 105, 0.2)',
  statusPublishedForeground: '#a8e08a',
  statusPendingBackground: 'rgba(252, 204, 74, 0.2)',
  statusPendingForeground: '#ffd76e',
  statusRejectedBackground: 'rgba(255, 100, 100, 0.2)',
  statusRejectedForeground: '#ff9b9b',
}

/** Сопоставление палитры и CSS-переменных панели. */
const PALETTE_VARIABLES: Record<keyof TrackerPalette, string> = {
  background: '--nmap-ot-bg',
  foreground: '--nmap-ot-fg',
  muted: '--nmap-ot-muted',
  border: '--nmap-ot-border',
  cardBackground: '--nmap-ot-card-bg',
  cardBorder: '--nmap-ot-card-border',
  link: '--nmap-ot-link',
  accent: '--nmap-ot-accent',
  accentForeground: '--nmap-ot-accent-fg',
  inputBackground: '--nmap-ot-input-bg',
  hover: '--nmap-ot-hover',
  selectedBackground: '--nmap-ot-selected-bg',
  warningBackground: '--nmap-ot-warning-bg',
  warningForeground: '--nmap-ot-warning-fg',
  error: '--nmap-ot-error',
  newBackground: '--nmap-ot-new-bg',
  newBorder: '--nmap-ot-new-border',
  statusPublishedBackground: '--nmap-ot-status-published-bg',
  statusPublishedForeground: '--nmap-ot-status-published-fg',
  statusPendingBackground: '--nmap-ot-status-pending-bg',
  statusPendingForeground: '--nmap-ot-status-pending-fg',
  statusRejectedBackground: '--nmap-ot-status-rejected-bg',
  statusRejectedForeground: '--nmap-ot-status-rejected-fg',
}

/** Тёмный класс на панели: включает `color-scheme` для нативных контролов. */
export const TRACKER_DARK_CLASS = 'nmap-ot-dark'

export const resolveTrackerPalette = (theme: Theme): TrackerPalette =>
  theme === 'dark' ? TRACKER_PALETTE_DARK : TRACKER_PALETTE_LIGHT

/** Красит панель: переменные ставим инлайново, чтобы не зависеть от темы страницы. */
export const applyTrackerTheme = (
  panel: HTMLElement,
  theme: Theme,
  options?: { prefersDark?: boolean },
): void => {
  const palette = resolveTrackerPalette(theme)

  for (const [key, variable] of Object.entries(PALETTE_VARIABLES)) {
    panel.style.setProperty(variable, palette[key as keyof TrackerPalette])
  }

  const prefersDark = options?.prefersDark ?? theme === 'dark'
  panel.classList.toggle(TRACKER_DARK_CLASS, prefersDark)
  panel.style.setProperty('color-scheme', prefersDark ? 'dark' : 'light')
}

export interface TrackerThemeController {
  /** Текущая тема панели. */
  getTheme: () => Theme
  /** Применяет текущую тему к переданной панели. */
  apply: (panel: HTMLElement) => void
  /** Следит за настройкой темы расширения и системной темой. */
  observe: (onChange: () => void) => () => void
}

/**
 * Контроллер темы панели наблюдения.
 *
 * Тема берётся из настроек расширения (как у go-to меню), а для режима
 * «Авто» — из системных предпочтений.
 */
export const createTrackerThemeController = (options?: {
  initialMode?: ThemeMode
}): TrackerThemeController => {
  let mode: ThemeMode = options?.initialMode ?? 'system'
  let theme: Theme = resolveSystemOrMode(mode)

  function resolveSystemOrMode(current: ThemeMode): Theme {
    if (current === 'system') {
      try {
        return getSystemTheme()
      } catch {
        return 'light'
      }
    }
    return resolveTheme(current)
  }

  const getTheme = (): Theme => theme

  const apply = (panel: HTMLElement): void => {
    applyTrackerTheme(panel, theme)
  }

  const observe = (onChange: () => void): (() => void) => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const refresh = (): void => {
      const next = resolveSystemOrMode(mode)
      if (next === theme) {
        return
      }
      theme = next
      onChange()
    }

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (area !== 'local' || !(THEME_STORAGE_KEY in changes)) {
        return
      }
      const nextValue = changes[THEME_STORAGE_KEY]?.newValue
      if (nextValue === 'light' || nextValue === 'dark' || nextValue === 'system') {
        mode = nextValue
        refresh()
      }
    }

    const handleSystemChange = (): void => {
      if (mode === 'system') {
        refresh()
      }
    }

    const load = async (): Promise<void> => {
      try {
        mode = await getStoredExtensionThemeMode()
        refresh()
      } catch (error: unknown) {
        console.warn('[nmap_uploader] object tracker theme load failed:', error)
      }
    }

    void load()

    mediaQuery.addEventListener('change', handleSystemChange)
    browser.storage.onChanged.addListener(handleStorageChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange)
      browser.storage.onChanged.removeListener(handleStorageChange)
    }
  }

  return { getTheme, apply, observe }
}
