import { getErrorMessage } from '@/lib/errors'
import { createTranslator, type Locale } from '@/lib/i18n'
import { type AuthPayload, loadUserAvatarDataUrl, type YandexUser } from '@/lib/yandex/client'

export type AuthMessageResponse = {
  ok: boolean
  user: YandexUser | null
  avatarDataUrl: string | null
  error?: string
}

/**
 * Перевод строк фона: язык приходит от панели, которой адресован ответ.
 *
 * Своего языка у фона нет — страницу редактора он не видит (ADR 0021).
 */
export const getBackgroundTranslator = (locale: Locale) => createTranslator(locale)

export const handleYandexAuthSuccess = async (
  auth: AuthPayload | null,
  sendResponse: (response: AuthMessageResponse) => void,
  cancelError?: string,
): Promise<void> => {
  if (auth?.user) {
    const avatarDataUrl = await loadUserAvatarDataUrl(auth.user)
    sendResponse({
      ok: true,
      user: auth.user,
      avatarDataUrl,
    })
  } else {
    sendResponse({
      ok: false,
      user: null,
      avatarDataUrl: null,
      ...(cancelError && { error: cancelError }),
    })
  }
}

export const handleYandexAuthFailure = async (
  error: unknown,
  sendResponse: (response: AuthMessageResponse) => void,
  logLabel: string,
  locale: Locale,
): Promise<void> => {
  console.error(`[yamapper] ${logLabel} failed:`, error)
  const t = getBackgroundTranslator(locale)
  const authErrorFallback = t('auth.authError')
  const errorMessage = getErrorMessage(error, authErrorFallback)
  sendResponse({
    ok: false,
    user: null,
    avatarDataUrl: null,
    error: errorMessage,
  })
}
