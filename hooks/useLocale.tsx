import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { createTranslator, type TranslateFn } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/locale.types'
import { getNativeLocaleSnapshot, subscribeNativeLocale } from '@/lib/native_locale'

type LocaleContextValue = {
  locale: Locale
  t: TranslateFn
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/**
 * Ставит `lang` на документ: панели живут в iframe'ах с захардкоженным
 * `lang="ru"`, а язык следует за редактором (ADR 0021).
 */
function applyDocumentLang(locale: Locale): void {
  if (document.documentElement.lang !== locale) {
    document.documentElement.lang = locale
  }
}

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(getNativeLocaleSnapshot)

  useEffect(function localeSubscribeEffect() {
    return subscribeNativeLocale(setLocaleState)
  }, [])

  useEffect(
    function localeDocumentLangEffect() {
      applyDocumentLang(locale)
    },
    [locale],
  )

  const t = useMemo(
    function localeTranslator() {
      return createTranslator(locale)
    },
    [locale],
  )

  return <LocaleContext.Provider value={{ locale, t }}>{children}</LocaleContext.Provider>
}

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}

export const useTranslate = (): TranslateFn => {
  const { t } = useLocale()
  return t
}
