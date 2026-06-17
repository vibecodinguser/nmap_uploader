export type Locale = 'ru' | 'en'

export const DEFAULT_LOCALE: Locale = 'ru'
export const LOCALE_STORAGE_KEY = 'locale'

export const LOCALE_OPTIONS: { value: Locale; labelKey: 'locale.ru' | 'locale.en' }[] = [
  { value: 'ru', labelKey: 'locale.ru' },
  { value: 'en', labelKey: 'locale.en' },
]

export const isLocale = (value: unknown): value is Locale => value === 'ru' || value === 'en'

export const localeFromUiLanguage = (uiLanguage: string): Locale =>
  uiLanguage.toLowerCase().startsWith('ru') ? 'ru' : 'en'
