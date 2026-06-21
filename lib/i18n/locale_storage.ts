import { browser } from 'wxt/browser'
import { isLocale, LOCALE_STORAGE_KEY, localeFromUiLanguage } from '@/lib/i18n/locale'
import type { Locale } from '@/lib/i18n/locale.types'
import { setRuntimeLocale } from '@/lib/i18n/locale_state'

export async function getStoredLocale(): Promise<Locale> {
  const stored = await browser.storage.local.get(LOCALE_STORAGE_KEY)
  const value = stored[LOCALE_STORAGE_KEY]

  let locale: Locale
  if (isLocale(value)) {
    locale = value
  } else {
    const uiLanguage = browser.i18n.getUILanguage()
    locale = localeFromUiLanguage(uiLanguage)
    await browser.storage.local.set({ [LOCALE_STORAGE_KEY]: locale })
  }

  return locale
}

export async function setStoredLocale(locale: Locale): Promise<void> {
  setRuntimeLocale(locale)
  await browser.storage.local.set({ [LOCALE_STORAGE_KEY]: locale })
}

export async function syncLocaleFromStorage(): Promise<Locale> {
  const locale = await getStoredLocale()
  setRuntimeLocale(locale)
  return locale
}
