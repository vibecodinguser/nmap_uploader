/**
 * Сервис аутентификации и работы с учетной записью Яндекс для background.
 */
import { runBackgroundTask } from '@/lib/background/tasks'
import { getErrorMessage } from '@/lib/errors'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import {
  type AuthPayload,
  buildAuthPayload,
  clearAuth,
  ensureYandexAuth,
  getStoredAuth,
  listExistingDateFolders,
  loadUserAvatarDataUrl,
  type YandexUser,
} from '@/lib/yandex/client'

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

export const processYandexAuthMessage = async ({
  interactive,
  sendResponse,
  logLabel,
  cancelError,
}: {
  interactive: boolean
  sendResponse: (response: AuthMessageResponse) => void
  logLabel: string
  cancelError?: string
}): Promise<void> => {
  try {
    const auth = await ensureYandexAuth({ interactive })
    const payload = await buildAuthPayload(auth)
    await handleYandexAuthSuccess(payload, sendResponse, cancelError)
  } catch (error: unknown) {
    await handleYandexAuthFailure(error, sendResponse, logLabel)
  }
}

export const handleYandexAuthMessage = ({
  interactive,
  sendResponse,
  logLabel,
  cancelError,
}: {
  interactive: boolean
  sendResponse: (response: AuthMessageResponse) => void
  logLabel: string
  cancelError?: string
}): void => {
  const authTask = processYandexAuthMessage({
    interactive,
    sendResponse,
    logLabel,
    cancelError,
  })
  runBackgroundTask(authTask, logLabel)
}

export const processGetAuth = async (
  sendResponse: (response: AuthPayload | { user: null; avatarDataUrl: null }) => void,
): Promise<void> => {
  try {
    const auth = await getStoredAuth()
    const payload = await buildAuthPayload(auth)
    sendResponse(payload)
  } catch {
    sendResponse({ user: null, avatarDataUrl: null })
  }
}

export const processLogin = async (
  sendResponse: (response: AuthMessageResponse) => void,
): Promise<void> => {
  const t = await getBackgroundTranslator()
  const authCancelledMessage = t('auth.authCancelled')
  await processYandexAuthMessage({
    interactive: true,
    sendResponse,
    logLabel: 'login',
    cancelError: authCancelledMessage,
  })
}

export const processLoginAccessDenied = async (
  sendResponse: (response: AuthMessageResponse) => void,
): Promise<void> => {
  const t = await getBackgroundTranslator()
  const accessDeniedMessage = t('common.accessDenied')
  sendResponse({
    ok: false,
    user: null,
    avatarDataUrl: null,
    error: accessDeniedMessage,
  })
}

export const processLogout = async (
  sendResponse: (response: { ok: boolean }) => void,
): Promise<void> => {
  try {
    await clearAuth({ explicit: true })
    sendResponse({ ok: true })
  } catch (error: unknown) {
    console.error('[nmap_uploader] logout failed:', error)
    sendResponse({ ok: false })
  }
}

export const processListOccupiedDates = async (
  sendResponse: (response: { ok: boolean; dates: string[]; error?: string }) => void,
): Promise<void> => {
  try {
    const auth = await getStoredAuth()
    if (auth) {
      const dates = await listExistingDateFolders({ token: auth.token })
      sendResponse({ ok: true, dates })
    } else {
      sendResponse({ ok: true, dates: [] })
    }
  } catch (error: unknown) {
    console.error('[nmap_uploader] listOccupiedDates failed:', error)
    const t = await getBackgroundTranslator()
    const folderReadErrorFallback = t('auth.folderReadError')
    sendResponse({
      ok: false,
      dates: [],
      error: getErrorMessage(error, folderReadErrorFallback),
    })
  }
}
