import { browser } from 'wxt/browser'
import { isFirefox } from '@/lib/browser'
import {
  getStoredExtensionThemeMode,
  getSystemTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/lib/theme'

export const GO_TO_MENU_ITEM_HOVER_VAR = '--nmap-uploader-menu-item-hover-bg'

const GO_TO_THEME_TARGETS =
  '.nmap-uploader-popup:not(.nmap-uploader-popup--tooltip), .nmap-uploader-split'

export type GoToThemeColors = {
  background: string
  color: string
  hoverBackground: string
  boxShadow: string
}

const GO_TO_THEME_LIGHT: GoToThemeColors = {
  background: '#ffffff',
  color: '#000000',
  hoverBackground: '#ffeba0',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
}

const GO_TO_THEME_DARK: GoToThemeColors = {
  background: '#45464f',
  color: '#ededed',
  hoverBackground: '#4d4d4d',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
}

/** Совпадает с --dark-surface в theme_tokens.css для Firefox. */
const GO_TO_THEME_DARK_FIREFOX: GoToThemeColors = {
  background: '#333333',
  color: '#ededed',
  hoverBackground: '#4d4d4d',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
}

let resolvedExtensionTheme: Theme = 'light'

export const resolveGoToThemeColors = (
  theme: Theme,
  options?: { isFirefox?: boolean },
): GoToThemeColors => {
  let colors = GO_TO_THEME_LIGHT
  if (theme === 'dark') {
    const useFirefoxDark = options?.isFirefox ?? isFirefox()
    if (useFirefoxDark) {
      colors = GO_TO_THEME_DARK_FIREFOX
    } else {
      colors = GO_TO_THEME_DARK
    }
  }
  return colors
}

export const readGoToThemeColors = (): GoToThemeColors => {
  return resolveGoToThemeColors(resolvedExtensionTheme)
}

export const refreshGoToThemeFromStorage = async (): Promise<void> => {
  const mode = await getStoredExtensionThemeMode()
  resolvedExtensionTheme = resolveTheme(mode)
}

const applyThemeColors = (element: HTMLElement, colors: GoToThemeColors): void => {
  element.style.setProperty('background-color', colors.background, 'important')
  element.style.setProperty('color', colors.color, 'important')
  element.style.setProperty('box-shadow', colors.boxShadow, 'important')
  element.style.setProperty(GO_TO_MENU_ITEM_HOVER_VAR, colors.hoverBackground)
}

export const applyGoToTheme = (element: HTMLElement): void => {
  if (!element.classList.contains('nmap-uploader-popup--tooltip')) {
    const colors = readGoToThemeColors()
    applyThemeColors(element, colors)
  }
}

export const syncGoToTheme = (): void => {
  const colors = readGoToThemeColors()
  for (const element of document.querySelectorAll<HTMLElement>(GO_TO_THEME_TARGETS)) {
    applyThemeColors(element, colors)
  }
}

let themeSyncTimer: ReturnType<typeof setTimeout> | undefined

const runScheduledThemeSync = (): void => {
  themeSyncTimer = undefined
  syncGoToTheme()
}

const scheduleSyncGoToTheme = (): void => {
  clearTimeout(themeSyncTimer)
  themeSyncTimer = setTimeout(runScheduledThemeSync, 0)
}

const refreshAndSyncGoToTheme = async (): Promise<void> => {
  await refreshGoToThemeFromStorage()
  scheduleSyncGoToTheme()
}

const syncFromSystemThemeIfNeeded = async (): Promise<void> => {
  const mode = await getStoredExtensionThemeMode()
  if (mode === 'system') {
    resolvedExtensionTheme = getSystemTheme()
    scheduleSyncGoToTheme()
  }
}

const onThemeSyncError = (): void => {
  // Синхронизация темы best-effort; сбой не блокирует UI карты.
}

const handleThemeSyncTask = (syncTask: Promise<void>): void => {
  syncTask.catch(onThemeSyncError)
}

const startThemeSyncTask = (task: () => Promise<void>): void => {
  const syncTask = task()
  handleThemeSyncTask(syncTask)
}

/** Следит за темой расширения из настроек и синхронизирует go-to UI на карте. */
export const observeGoToTheme = (): (() => void) => {
  const syncFromStorage = (): void => {
    startThemeSyncTask(refreshAndSyncGoToTheme)
  }

  const onSystemThemeChange = (): void => {
    startThemeSyncTask(syncFromSystemThemeIfNeeded)
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', onSystemThemeChange)

  const onStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string): void => {
    if (area === 'local' && THEME_STORAGE_KEY in changes) {
      syncFromStorage()
    }
  }

  const disconnectGoToThemeObserver = (): void => {
    clearTimeout(themeSyncTimer)
    themeSyncTimer = undefined
    mediaQuery.removeEventListener('change', onSystemThemeChange)
    browser?.storage?.onChanged?.removeListener(onStorageChange)
  }

  browser.storage.onChanged.addListener(onStorageChange)
  syncFromStorage()

  return disconnectGoToThemeObserver
}
