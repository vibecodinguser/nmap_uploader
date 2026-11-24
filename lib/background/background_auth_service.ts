/**
 * Сервис аутентификации и работы с учетной записью Яндекс для background.
 */
import { resetNotesSession } from '@/lib/background/notes/guard'
import { runBackgroundTask } from '@/lib/background/tasks'
import { getErrorMessage } from '@/lib/errors'
import {
  type AuthPayload,
  buildAuthPayload,
  clearAuth,
  ensureYandexAuth,
  getStoredAuth,
  listExistingDateFolders,
} from '@/lib/yandex/client'
import {
  type AuthMessageResponse,
  getBackgroundTranslator,
  handleYandexAuthFailure,
  handleYandexAuthSuccess,
} from './auth_message_response_helpers'

export * from './auth_message_response_helpers'

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
    // Заметки прошлого аккаунта не должны остаться ни в памяти, ни в кэше:
    // иначе после входа другим пользователем панель показала бы чужой снимок.
    await resetNotesSession()
    sendResponse({ ok: true })
  } catch (error: unknown) {
    console.error('[yamapper] logout failed:', error)
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
    console.error('[yamapper] listOccupiedDates failed:', error)
    const t = await getBackgroundTranslator()
    const folderReadErrorFallback = t('auth.folderReadError')
    sendResponse({
      ok: false,
      dates: [],
      error: getErrorMessage(error, folderReadErrorFallback),
    })
  }
}
