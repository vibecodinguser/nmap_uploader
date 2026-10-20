export type Theme = 'light' | 'dark'
export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'theme'

/**
 * Нормализует режим темы в 'light' | 'dark' | 'system' (чистая функция).
 */
export const normalizeThemeMode = (value: unknown): ThemeMode => {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

export type ResolveThemeInput = {
  mode: ThemeMode
  isSystemDark: boolean
}

/**
 * Разрешает эффективную тему ('light' или 'dark') без обращения к window (чистая функция).
 */
export const resolveTheme = ({ mode, isSystemDark }: ResolveThemeInput): Theme => {
  if (mode === 'system') {
    return isSystemDark ? 'dark' : 'light'
  }
  return mode
}
