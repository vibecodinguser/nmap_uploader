/**
 * Обработчики аутентификации и работы с Яндекс Диском для background message router.
 */
import type { MessageHandler } from '@/lib/background/message_router'
import { runBackgroundTask } from '@/lib/background/tasks'
import { isTrustedPanelSender, logRejectedMessage } from '@/lib/message_auth'
import {
  handleYandexAuthMessage,
  processGetAuth,
  processListOccupiedDates,
  processLogin,
  processLoginAccessDenied,
  processLogout,
} from './background_auth_service'
import { processUpload, processUploadAccessDenied } from './background_upload_service'

export * from './background_auth_service'
export * from './background_upload_service'

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
