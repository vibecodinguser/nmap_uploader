/**
 * Язык нативного редактора как единственный источник языка расширения.
 *
 * Ручной выбор языка удалён (см. ADR 0021): он давал панелям язык, отличный
 * от редактора, и требовал синхронизации между страницами расширения — ровно
 * та же проблема, что была у темы до ADR 0020.
 */
import { DEFAULT_LOCALE, isLocale, localeFromUiLanguage } from '@/lib/i18n/locale'
import type { Locale } from '@/lib/i18n/locale.types'

/**
 * Последний известный язык редактора; пока мост не сообщил его (или за его
 * пределами) — русский.
 *
 * Хранилище синхронное: панели должны получить свой язык сразу при первом
 * рендере, без `await`, иначе интерфейс мигает русским.
 */
let nativeLocaleState: Locale = DEFAULT_LOCALE
const nativeLocaleListeners = new Set<(locale: Locale) => void>()

/** Язык редактора, полученный из iframe-моста или из DOM хоста. */
export const setNativeLocale = (locale: Locale): void => {
  if (nativeLocaleState === locale) return
  nativeLocaleState = locale
  for (const listener of nativeLocaleListeners) listener(locale)
}

export const getNativeLocaleSnapshot = (): Locale => nativeLocaleState

export const subscribeNativeLocale = (listener: (locale: Locale) => void): (() => void) => {
  nativeLocaleListeners.add(listener)
  return () => {
    nativeLocaleListeners.delete(listener)
  }
}

/**
 * Язык нативного редактора по атрибуту `lang` страницы.
 *
 * Русский — только для `ru*`; всё остальное (`en`, `en-US`, `uk`, `be`, …)
 * читаем как английский: редактор НЯК переводится на два языка. Атрибута
 * может ещё не быть на `document_idle` — тогда опираемся на язык браузера.
 */
export const readNativeLocale = (): Locale => {
  const pageLang = document.documentElement.lang
  if (pageLang) return localeFromUiLanguage(pageLang)
  return localeFromUiLanguage(navigator.language || DEFAULT_LOCALE)
}

/**
 * Следит за языком редактора и сообщает о каждом изменении.
 *
 * Наблюдатель нужен iframe'ам расширения: у них другой origin и свой DOM, язык
 * редактора им недоступен, и они узнают о смене только сообщением. Смена языка
 * в редакторе — это изменение `lang` на `<html>`, без перезагрузки страницы.
 */
export const observeNativeLocale = (onChange: (locale: Locale) => void): (() => void) => {
  let active = true
  let lastLocale = readNativeLocale()

  const emit = (): void => {
    if (!active) return
    const nextLocale = readNativeLocale()
    if (nextLocale === lastLocale) return
    lastLocale = nextLocale
    onChange(nextLocale)
  }

  const observer = new MutationObserver(emit)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang'],
  })

  // Атрибут мог отсутствовать при старте: тогда язык уточнится позже, и это
  // тоже смена — но без него повторного уведомления не будет.
  emit()

  return () => {
    active = false
    observer.disconnect()
  }
}

/** Переводит значение из моста в `Locale`; `null` — значение мусорное. */
export const toNativeLocale = (value: unknown): Locale | null => (isLocale(value) ? value : null)
