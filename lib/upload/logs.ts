import { createTranslator, type Locale } from '@/lib/i18n'
import { getRuntimeLocale } from '@/lib/i18n/locale_state'
import { isUploadCompleteMessage } from '@/lib/i18n/upload_complete'
import type { UploadLogEntry, UploadLogLevel, UploadStatus } from './types'

export const createUploadLog = (level: UploadLogLevel, message: string): UploadLogEntry => ({
  id: crypto.randomUUID(),
  level,
  message,
})

export const deriveUploadStatus = (
  logs: UploadLogEntry[],
  locale: Locale = getRuntimeLocale(),
): UploadStatus => {
  const t = createTranslator(locale)
  const errorLog = [...logs].reverse().find((log) => log.level === 'error')
  if (errorLog) {
    return { level: 'error', message: errorLog.message }
  }

  const summaryLog = [...logs].reverse().find((log) => isUploadCompleteMessage(log.message, locale))
  if (summaryLog) {
    return { level: 'success', message: summaryLog.message }
  }

  const successLog = [...logs].reverse().find((log) => log.level === 'success')
  return {
    level: 'success',
    message: successLog?.message ?? t('upload.uploadComplete'),
  }
}

export const waitForNextFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

export const getUploadStatusClassName = (level: UploadLogLevel): string => {
  if (level === 'error') return 'upload-progress-status upload-progress-status--error'
  if (level === 'success') return 'upload-progress-status upload-progress-status--success'
  return 'upload-progress-status'
}
