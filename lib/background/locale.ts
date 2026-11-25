import { browser } from 'wxt/browser'
import { isLocale, localeFromUiLanguage } from '@/lib/i18n/locale'
import type { Locale } from '@/lib/i18n/locale.types'

/**
 * Язык для строк фонового процесса.
 *
 * Фон живёт вне страницы редактора и своего DOM не видит. Контент-скрипты
 * кладут свой язык во входящее сообщение; когда сообщения нет (клик по иконке
 * расширения), остаётся язык браузера — ровно то, что фон использовал и раньше.
 */
export const getBackgroundLocale = (message?: unknown): Locale => {
  const fromMessage = (message as { locale?: unknown } | null | undefined)?.locale
  if (isLocale(fromMessage)) return fromMessage
  return localeFromUiLanguage(browser.i18n.getUILanguage())
}
