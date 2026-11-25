import type { Theme } from '@/lib/theme'

/** Сообщение хост → iframe с текущей темой редактора. */
export const NATIVE_THEME_MESSAGE = 'YAMAPPER_NATIVE_THEME'

/** Начальная тема в URL iframe: позволяет не мигать светлой темой до `load`. */
export const NATIVE_THEME_QUERY_PARAM = 'nativeTheme'

export const withNativeThemeParam = (url: string, theme: Theme): string => {
  const hashIndex = url.indexOf('#')
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}${NATIVE_THEME_QUERY_PARAM}=${theme}${hash}`
}
