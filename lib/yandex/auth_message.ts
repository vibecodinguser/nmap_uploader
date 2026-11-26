import { browser } from 'wxt/browser'
import type { Locale } from '@/lib/i18n/locale.types'
import type { YandexUser } from './client'

type EnsureAuthResponse = {
  ok: boolean
  user?: YandexUser | null
  avatarDataUrl?: string | null
  error?: string
}

/**
 * Запрос восстановления сессии через background script.
 *
 * `locale` — язык вызвавшей панели: ошибки авторизации фон переводит сам, а
 * язык редактора ему недоступен (ADR 0021).
 */
export const requestEnsureAuth = async ({
  interactive,
  locale,
}: {
  interactive: boolean
  locale?: Locale
}): Promise<EnsureAuthResponse> => {
  const response = (await browser.runtime.sendMessage({
    action: 'ensureAuth',
    interactive,
    locale,
  })) as EnsureAuthResponse | undefined
  return response ?? { ok: false }
}
