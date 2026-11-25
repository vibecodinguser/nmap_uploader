/* jshint esversion: 11, module: true */
/* exported DEFAULT_LOCALE, isLocale, localeFromUiLanguage */

export const DEFAULT_LOCALE = 'ru'

// noinspection JSUnusedGlobalSymbols
export function isLocale(value) {
  return value === 'ru' || value === 'en'
}

// noinspection JSUnusedGlobalSymbols
export function localeFromUiLanguage(uiLanguage) {
  const normalized = uiLanguage.toLowerCase()
  const isRussian = normalized.startsWith('ru')
  let locale = 'en'
  if (isRussian) {
    locale = 'ru'
  }
  return locale
}
