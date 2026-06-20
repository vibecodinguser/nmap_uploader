/* jshint esversion: 11, module: true */
/* exported DEFAULT_LOCALE, LOCALE_STORAGE_KEY, LOCALE_OPTIONS, isLocale, localeFromUiLanguage */

export const DEFAULT_LOCALE = 'ru';
export const LOCALE_STORAGE_KEY = 'locale';

const localeRuLabelKey = ['locale', 'ru'].join('.');
const localeEnLabelKey = ['locale', 'en'].join('.');

// noinspection JSUnusedGlobalSymbols
export const LOCALE_OPTIONS = [
  { value: 'ru', labelKey: localeRuLabelKey },
  { value: 'en', labelKey: localeEnLabelKey },
];

// noinspection JSUnusedGlobalSymbols
export function isLocale(value) {
  return value === 'ru' || value === 'en';
}

// noinspection JSUnusedGlobalSymbols
export function localeFromUiLanguage(uiLanguage) {
  const normalized = uiLanguage.toLowerCase();
  const isRussian = normalized.startsWith('ru');
  let locale = 'en';
  if (isRussian) {
    locale = 'ru';
  }
  return locale;
}
