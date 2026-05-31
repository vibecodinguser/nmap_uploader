import { browser } from 'wxt/browser'
import { createUploadLog } from '@/lib/upload_logs'
import type { UploadLogEntry } from '@/lib/upload_service'
import { requestEnsureAuth } from '@/lib/yandex/auth_message'

export const UPLOAD_AUTH_ERROR_MESSAGE =
  'Для загрузки нужен доступ к Яндекс.Диску. Разрешите запись в окне Яндекс ID'

export const SESSION_EXPIRED_LOG_MESSAGE = 'Сессия истекла. Повторите загрузку для повторного входа'

export const hasUploadAuthError = (logs: UploadLogEntry[]): boolean =>
  logs.some(
    (log) =>
      log.level === 'error' &&
      (log.message.includes('сессия недействительна') || log.message.includes('Выйдите и войдите')),
  )

export const ensureUploadAuth = async ({
  onAuthenticated,
}: {
  onAuthenticated?: () => void
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  const authResponse = await requestEnsureAuth({ interactive: true })
  if (!authResponse.ok) {
    return {
      ok: false,
      message: authResponse.error ?? UPLOAD_AUTH_ERROR_MESSAGE,
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
  await browser.runtime.sendMessage({ action: 'logout' })
  return [...priorLogs, ...uploadLogs, createUploadLog('error', SESSION_EXPIRED_LOG_MESSAGE)]
}
