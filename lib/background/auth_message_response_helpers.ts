import { getErrorMessage } from '@/lib/errors'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { type AuthPayload, loadUserAvatarDataUrl, type YandexUser } from '@/lib/yandex/client'

export type AuthMessageResponse = {
  ok: boolean
  user: YandexUser | null
  avatarDataUrl: string | null
  error?: string
}

export const getBackgroundTranslator = async () => {
  const locale = await syncLocaleFromStorage()
  return createTranslator(locale)
}

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
): Promise<void> => {
  console.error(`[nmap_uploader] ${logLabel} failed:`, error)
  const t = await getBackgroundTranslator()
  const authErrorFallback = t('auth.authError')
  const errorMessage = getErrorMessage(error, authErrorFallback)
  sendResponse({
    ok: false,
    user: null,
    avatarDataUrl: null,
    error: errorMessage,
  })
}
