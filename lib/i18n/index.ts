import { browser } from 'wxt/browser'
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, type Locale } from '@/lib/i18n/locale'
import { enMessages } from '@/lib/i18n/messages/en'
import { type MessageKey, type Messages, ruMessages } from '@/lib/i18n/messages/ru'

export type { Locale, MessageKey, Messages }

const messagesByLocale: Record<Locale, Messages> = {
  ru: ruMessages,
  en: enMessages,
}

const getNestedMessage = (messages: Messages, key: MessageKey): string => {
  const [section, field] = key.split('.') as [keyof Messages, string]
  const sectionValue = messages[section]
  if (typeof sectionValue === 'object' && field in sectionValue) {
    return sectionValue[field as keyof typeof sectionValue] as string
  }
  throw new Error(`Missing i18n message: ${key}`)
}

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    return value === undefined ? `{${key}}` : String(value)
  })
}

export type TranslateFn = (key: MessageKey, params?: Record<string, string | number>) => string

export const createTranslator = (locale: Locale): TranslateFn => {
  const messages = messagesByLocale[locale]
  return (key, params) => interpolate(getNestedMessage(messages, key), params)
}

export const getUploadCompletePrefixes = (locale: Locale): string[] => [
  createTranslator(locale)('upload.uploadCompleteSummary').split(':')[0] ?? '',
  createTranslator('ru')('upload.uploadCompleteSummary').split(':')[0] ?? '',
]

export const isUploadCompleteMessage = (message: string, locale: Locale): boolean =>
  getUploadCompletePrefixes(locale).some((prefix) => prefix && message.startsWith(`${prefix}:`))

export const SESSION_INVALID_MARKERS = [
  'сессия недействительна',
  'Выйдите и войдите',
  'session is invalid',
  'Sign out and sign in',
] as const

export const hasUploadAuthErrorInLogs = (messages: string[]): boolean =>
  messages.some((message) =>
    SESSION_INVALID_MARKERS.some((marker) => message.toLowerCase().includes(marker.toLowerCase())),
  )

let runtimeLocale: Locale = DEFAULT_LOCALE

export const getRuntimeLocale = (): Locale => runtimeLocale

export const setRuntimeLocale = (locale: Locale): void => {
  runtimeLocale = locale
}

export const t = createTranslator(runtimeLocale)

export const getStoredLocale = async (): Promise<Locale> => {
  const stored = await browser.storage.local.get(LOCALE_STORAGE_KEY)
  const value = stored[LOCALE_STORAGE_KEY]
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export const setStoredLocale = async (locale: Locale): Promise<void> => {
  setRuntimeLocale(locale)
  await browser.storage.local.set({ [LOCALE_STORAGE_KEY]: locale })
}

export const syncLocaleFromStorage = async (): Promise<Locale> => {
  const locale = await getStoredLocale()
  setRuntimeLocale(locale)
  return locale
}

export const getGoToSourceDisplayName = (name: string, locale: Locale): string => {
  const sourceNames = messagesByLocale[locale].goToSources
  const localized = sourceNames[name as keyof typeof sourceNames]
  if (localized) return localized
  return name
}
