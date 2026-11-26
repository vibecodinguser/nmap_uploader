import { observeNativeTheme, readNativeTheme } from '@/lib/native_theme'
import type { Theme } from '@/lib/theme'

const GO_TO_MENU_ITEM_HOVER_VAR = '--yamapper-menu-item-hover-bg'

const GO_TO_THEME_TARGETS = '.yamapper-popup:not(.yamapper-popup--tooltip), .yamapper-split'

type GoToThemeColors = {
  background: string
  color: string
  hoverBackground: string
  boxShadow: string
}

const GO_TO_THEME_LIGHT: GoToThemeColors = {
  background: '#ffffff',
  color: '#000000',
  hoverBackground: '#f2f2f2',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
}

const GO_TO_THEME_DARK: GoToThemeColors = {
  background: '#333333',
  color: '#bfbfbf',
  hoverBackground: '#4d4d4d',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
}

/**
 * Цвета go-to UI. Одинаковы во всех браузерах: фон `#45464f` был в Chrome
 * против `#333333` в Firefox — это то же расхождение, что убрано из панели
 * (`docs/checklists/panel-parity.md`), а не особенность браузера.
 */
export const resolveGoToThemeColors = (theme: Theme): GoToThemeColors =>
  theme === 'dark' ? GO_TO_THEME_DARK : GO_TO_THEME_LIGHT

const readGoToThemeColors = (): GoToThemeColors => {
  return resolveGoToThemeColors(readNativeTheme())
}

const applyThemeColors = (element: HTMLElement, colors: GoToThemeColors): void => {
  element.style.setProperty('background-color', colors.background, 'important')
  element.style.setProperty('color', colors.color, 'important')
  element.style.setProperty('box-shadow', colors.boxShadow, 'important')
  element.style.setProperty(GO_TO_MENU_ITEM_HOVER_VAR, colors.hoverBackground)
}

export const applyGoToTheme = (element: HTMLElement): void => {
  // Подсказка всегда тёмная: её цвета заданы в CSS и от темы не зависят.
  if (element.classList.contains('yamapper-popup--tooltip')) {
    return
  }
  const colors = readGoToThemeColors()
  applyThemeColors(element, colors)
}

export const syncGoToTheme = (): void => {
  const colors = readGoToThemeColors()
  for (const element of document.querySelectorAll<HTMLElement>(GO_TO_THEME_TARGETS)) {
    applyThemeColors(element, colors)
  }
  const tooltip = document.querySelector<HTMLElement>('.yamapper-popup--tooltip')
  if (tooltip) {
    applyGoToTheme(tooltip)
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

/** Следит за темой редактора и перекрашивает go-to UI на карте. */
export const observeGoToTheme = (): (() => void) => {
  const stopNativeTheme = observeNativeTheme(scheduleSyncGoToTheme)

  scheduleSyncGoToTheme()

  return () => {
    clearTimeout(themeSyncTimer)
    themeSyncTimer = undefined
    stopNativeTheme()
  }
}
