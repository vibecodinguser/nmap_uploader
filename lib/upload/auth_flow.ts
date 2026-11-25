import { browser } from 'wxt/browser'
import { createTranslator, getNativeLocaleSnapshot } from '@/lib/i18n'
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
  const t = createTranslator(getNativeLocaleSnapshot())
  const authResponse = await requestEnsureAuth({
    interactive: true,
    locale: getNativeLocaleSnapshot(),
  })
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
  const t = createTranslator(getNativeLocaleSnapshot())
  await browser.runtime.sendMessage({ action: 'logout', locale: getNativeLocaleSnapshot() })
  return [...priorLogs, ...uploadLogs, createUploadLog('error', t('upload.sessionExpired'))]
}
