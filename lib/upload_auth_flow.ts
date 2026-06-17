import { browser } from 'wxt/browser'
import { createTranslator, getRuntimeLocale, syncLocaleFromStorage } from '@/lib/i18n'
import { createUploadLog } from '@/lib/upload_logs'
import type { UploadLogEntry } from '@/lib/upload_service'
import { requestEnsureAuth } from '@/lib/yandex/auth_message'

export const hasUploadAuthError = (logs: UploadLogEntry[]): boolean =>
  logs.some(
    (log) =>
      log.level === 'error' &&
      (log.message.includes('сессия недействительна') ||
        log.message.includes('Выйдите и войдите') ||
        log.message.toLowerCase().includes('session is invalid') ||
        log.message.includes('Sign out and sign in')),
  )

export const ensureUploadAuth = async ({
  onAuthenticated,
}: {
  onAuthenticated?: () => void
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  const t = createTranslator(getRuntimeLocale())
  const authResponse = await requestEnsureAuth({ interactive: true })
  if (!authResponse.ok) {
    return {
      ok: false,
      message: authResponse.error ?? t('upload.authDiskRequired'),
    }
  }

  onAuthenticated?.()
  return { ok: true }
}

export const buildExpiredSessionLogs = async ({
  priorLogs,
  uploadLogs,
}: {
  priorLogs: UploadLogEntry[]
  uploadLogs: UploadLogEntry[]
}): Promise<UploadLogEntry[]> => {
  const t = createTranslator(getRuntimeLocale())
  await browser.runtime.sendMessage({ action: 'logout' })
  return [...priorLogs, ...uploadLogs, createUploadLog('error', t('upload.sessionExpired'))]
}

export const prepareUploadLocale = async (): Promise<void> => {
  await syncLocaleFromStorage()
}
