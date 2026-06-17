import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { browser } from 'wxt/browser'
import {
  createTranslator,
  getStoredLocale,
  type Locale,
  setRuntimeLocale,
  setStoredLocale,
  type TranslateFn,
} from '@/lib/i18n'
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from '@/lib/i18n/locale'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslateFn
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    getStoredLocale().then((storedLocale) => {
      setLocaleState(storedLocale)
      setRuntimeLocale(storedLocale)
    })
  }, [])

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !(LOCALE_STORAGE_KEY in changes)) return
      const nextLocale = changes[LOCALE_STORAGE_KEY]?.newValue
      if (nextLocale === 'ru' || nextLocale === 'en') {
        setLocaleState(nextLocale)
        setRuntimeLocale(nextLocale)
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => browser.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    setRuntimeLocale(nextLocale)
    void setStoredLocale(nextLocale)
  }, [])

  const t = useMemo(() => createTranslator(locale), [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
  )
}

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}

export const useTranslate = (): TranslateFn => useLocale().t
