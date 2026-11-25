import type { Locale } from '@/lib/i18n/locale.types'

/** Сообщение хост → iframe с текущим языком редактора. */
export const NATIVE_LOCALE_MESSAGE = 'YAMAPPER_NATIVE_LOCALE'

/** Начальный язык в URL iframe: позволяет не мигать русским до `load`. */
export const NATIVE_LOCALE_QUERY_PARAM = 'nativeLocale'

export const withNativeLocaleParam = (url: string, locale: Locale): string => {
  const hashIndex = url.indexOf('#')
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}${NATIVE_LOCALE_QUERY_PARAM}=${locale}${hash}`
}
