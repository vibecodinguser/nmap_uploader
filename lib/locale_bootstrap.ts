import type { Locale } from '@/lib/i18n/locale.types'
import { NATIVE_LOCALE_MESSAGE, NATIVE_LOCALE_QUERY_PARAM } from '@/lib/locale_bridge'
import {
  getNativeLocaleSnapshot,
  setNativeLocale,
  subscribeNativeLocale,
  toNativeLocale,
} from '@/lib/native_locale'

const readNativeLocaleFromLocation = (): Locale | null => {
  const value = new URLSearchParams(window.location.search).get(NATIVE_LOCALE_QUERY_PARAM)
  return toNativeLocale(value)
}

/**
 * Принимает язык редактора внутри iframe.
 *
 * Начальное значение приходит в URL (его ставит хост при создании iframe), а
 * дальнейшие изменения — сообщением. Без этого панель не может узнать язык
 * редактора: у неё другой origin и свой DOM.
 */
export const initNativeLocaleBridge = (): (() => void) => {
  const initialLocale = readNativeLocaleFromLocation()
  if (initialLocale) setNativeLocale(initialLocale)

  const handleMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent) return
    const data = event.data as { action?: unknown; locale?: unknown } | null | undefined
    if (data?.action !== NATIVE_LOCALE_MESSAGE) return
    const nextLocale = toNativeLocale(data.locale)
    if (nextLocale) setNativeLocale(nextLocale)
  }

  window.addEventListener('message', handleMessage)
  return () => {
    window.removeEventListener('message', handleMessage)
  }
}

/**
 * Применяет язык редактора к элементу и подписывается на его смену.
 *
 * `lang` на `<html>` панели нужен скринридерам и режиму чтения: без него они
 * произносят английский текст русскими правилами (и наоборот).
 */
export const observeLocale = (onChange: (locale: Locale) => void): (() => void) => {
  const emit = (): void => {
    onChange(getNativeLocaleSnapshot())
  }

  emit()
  return subscribeNativeLocale(emit)
}
