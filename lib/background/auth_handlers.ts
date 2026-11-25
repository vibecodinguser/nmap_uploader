/**
 * Обработчики аутентификации и работы с Яндекс Диском для background message router.
 */

import type { MessageHandler } from '@/lib/background/message_router'
import { runBackgroundTask } from '@/lib/background/tasks'
import { getBackgroundLocale } from '@/lib/i18n'
import {
  isTrustedNmapsContentSender,
  isTrustedPanelSender,
  logRejectedMessage,
} from '@/lib/message_auth'
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
      locale: message.locale ?? getBackgroundLocale(),
    })
  } else {
    logRejectedMessage('ensureAuth', sender)
    sendResponse({ ok: false, user: null, avatarDataUrl: null })
  }
  return true
}

export const handleLogin: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const loginTask = processLogin(sendResponse, message.locale)
    runBackgroundTask(loginTask, 'login')
  } else {
    logRejectedMessage('login', sender)
    const accessDeniedTask = processLoginAccessDenied(sendResponse, message.locale)
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

export const handleListOccupiedDates: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender) || isTrustedNmapsContentSender(sender)) {
    const listDatesTask = processListOccupiedDates(sendResponse, message.locale)
    runBackgroundTask(listDatesTask, 'listOccupiedDates')
  } else {
    logRejectedMessage('listOccupiedDates', sender)
    sendResponse({ ok: false, dates: [] })
  }
  return true
}

/**
 * Язык вызвавшей панели в поле `locale` сообщения: сам фон языка редактора не
 * видит (ADR 0021), а строки он переводит сам и отправляет обратно. Без поля
 * (например, от content script) остаётся язык браузера.
 */
const withLocale = (message: Record<string, unknown>): Record<string, unknown> => {
  if ((message as { locale?: unknown }).locale !== undefined) return message
  return { locale: getBackgroundLocale(), ...message }
}

export const handleUpload: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const uploadTask = processUpload(withLocale(message), sendResponse)
    runBackgroundTask(uploadTask, 'uploadProcessedFiles')
  } else {
    logRejectedMessage('uploadProcessedFiles', sender)
    const accessDeniedTask = processUploadAccessDenied(sendResponse, message.locale)
    runBackgroundTask(accessDeniedTask, 'uploadProcessedFiles')
  }
  return true
}
