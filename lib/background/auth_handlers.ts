/**
 * Обработчики аутентификации и работы с Яндекс Диском для background message router.
 */

import type { MessageHandler } from '@/lib/background/message_router'
import { runBackgroundTask } from '@/lib/background/tasks'
import { getErrorMessage } from '@/lib/errors'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { isTrustedPanelSender, logRejectedMessage } from '@/lib/message_auth'
import {
  type ProcessedFileInput,
  type UploadResult,
  uploadProcessedFilesToYandexDisk,
} from '@/lib/upload_service'
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

export const getUploadMessagePayload = (
  message: Record<string, unknown>,
): { files: ProcessedFileInput[]; targetDate?: string } => {
  let files: ProcessedFileInput[] = []
  if (Array.isArray(message.files)) {
    files = message.files as ProcessedFileInput[]
  }

  let targetDate: string | undefined
  if ('string' === typeof message.targetDate) {
    targetDate = message.targetDate
  }

  return { files, targetDate }
}

export const processUpload = async (
  message: Record<string, unknown>,
  sendResponse: (response: UploadResult) => void,
): Promise<void> => {
  try {
    const { files, targetDate } = getUploadMessagePayload(message)
    const result = await uploadProcessedFilesToYandexDisk({ files, targetDate })
    sendResponse(result)
  } catch (error: unknown) {
    console.error('[nmap_uploader] upload failed:', error)
    const t = await getBackgroundTranslator()
    const uploadErrorFallback = t('auth.uploadError')
    sendResponse({
      ok: false,
      processedCount: 0,
      skippedCount: 0,
      logs: [
        {
          id: crypto.randomUUID(),
          level: 'error',
          message: getErrorMessage(error, uploadErrorFallback),
        },
      ],
    })
  }
}

export const processUploadAccessDenied = async (
  sendResponse: (response: UploadResult) => void,
): Promise<void> => {
  const t = await getBackgroundTranslator()
  const accessDeniedMessage = t('common.accessDenied')
  sendResponse({
    ok: false,
    processedCount: 0,
    skippedCount: 0,
    logs: [
      {
        id: crypto.randomUUID(),
        level: 'error',
        message: accessDeniedMessage,
      },
    ],
  })
}

export const handleGetAuth: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const authTask = processGetAuth(sendResponse)
    runBackgroundTask(authTask, 'getAuth')
  } else {
    logRejectedMessage('getAuth', sender)
    sendResponse({ user: null, avatarDataUrl: null })
  }
  return true
}

export const handleEnsureAuth: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    handleYandexAuthMessage({
      interactive: Boolean(message.interactive),
      sendResponse,
      logLabel: 'ensureAuth',
    })
  } else {
    logRejectedMessage('ensureAuth', sender)
    sendResponse({ ok: false, user: null, avatarDataUrl: null })
  }
  return true
}

export const handleLogin: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const loginTask = processLogin(sendResponse)
    runBackgroundTask(loginTask, 'login')
  } else {
    logRejectedMessage('login', sender)
    const accessDeniedTask = processLoginAccessDenied(sendResponse)
    runBackgroundTask(accessDeniedTask, 'login')
  }
  return true
}

export const handleLogout: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const logoutTask = processLogout(sendResponse)
    runBackgroundTask(logoutTask, 'logout')
  } else {
    logRejectedMessage('logout', sender)
    sendResponse({ ok: false })
  }
  return true
}

export const handleListOccupiedDates: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const listDatesTask = processListOccupiedDates(sendResponse)
    runBackgroundTask(listDatesTask, 'listOccupiedDates')
  } else {
    logRejectedMessage('listOccupiedDates', sender)
    sendResponse({ ok: false, dates: [] })
  }
  return true
}

export const handleUpload: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const uploadTask = processUpload(message, sendResponse)
    runBackgroundTask(uploadTask, 'uploadProcessedFiles')
  } else {
    logRejectedMessage('uploadProcessedFiles', sender)
    const accessDeniedTask = processUploadAccessDenied(sendResponse)
    runBackgroundTask(accessDeniedTask, 'uploadProcessedFiles')
  }
  return true
}
