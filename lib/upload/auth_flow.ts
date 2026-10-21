import { browser } from 'wxt/browser'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { getRuntimeLocale } from '@/lib/i18n/locale_state'
import { hasUploadAuthErrorInLogs } from '@/lib/i18n/upload_auth_logs'
import { requestEnsureAuth } from '@/lib/yandex/auth_message'
import { createUploadLog } from './logs'
import type { UploadAuthResult, UploadLogEntry } from './types'

export const hasUploadAuthError = (logs: UploadLogEntry[]): boolean =>
  hasUploadAuthErrorInLogs(logs.filter((log) => log.level === 'error').map((log) => log.message))

export const ensureUploadAuth = async ({
  onAuthenticated,
}: {
  onAuthenticated?: () => void
}): Promise<UploadAuthResult> => {
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
