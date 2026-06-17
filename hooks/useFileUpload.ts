import { useCallback, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { useTranslate } from '@/hooks/useLocale'
import { normalizeDisplayTargetDate } from '@/lib/date_format'
import { ProcessingError } from '@/lib/errors'
import { isAllowedFile } from '@/lib/formats'
import type { TranslateFn } from '@/lib/i18n'
import { invalidateOccupiedDatesCache } from '@/lib/occupied_dates_cache'
import {
  resolveReloadAfterUploadPreference,
  triggerEditorReloadIfNeeded,
} from '@/lib/reload_after_upload'
import {
  buildExpiredSessionLogs,
  ensureUploadAuth,
  hasUploadAuthError,
  prepareUploadLocale,
} from '@/lib/upload_auth_flow'
import { createUploadLog, deriveUploadStatus, type UploadStatus } from '@/lib/upload_logs'
import type { UploadLogEntry } from '@/lib/upload_service'
import { beginUploadSession, endUploadSession } from '@/lib/upload_session'

export type { UploadStatus } from '@/lib/upload_logs'

const normalizeTargetDate = normalizeDisplayTargetDate

/** Конвертирует один файл в JSON-результат — без передачи бинарных данных в background. */
const convertFileLocally = async (
  file: File,
  onProgress: (percent: number) => void,
  t: TranslateFn,
) => {
  const logs: UploadLogEntry[] = []
  const conversionEnd = 80

  if (!isAllowedFile(file.name)) {
    logs.push(createUploadLog('error', `✗ ${t('upload.unsupportedFormat', { file: file.name })}`))
    onProgress(conversionEnd)
    return { processed: null, logs }
  }

  logs.push(createUploadLog('info', t('upload.processing', { file: file.name })))
  try {
    const { processFile } = await import('@/lib/converters')
    const result = await processFile({ name: file.name, buffer: await file.arrayBuffer() })
    logs.push(createUploadLog('success', `✓ ${t('upload.converted', { file: file.name })}`))
    onProgress(conversionEnd)
    return { processed: { name: file.name, result }, logs }
  } catch (error) {
    const message = error instanceof ProcessingError ? error.message : t('common.unknownError')
    logs.push(createUploadLog('error', `✗ ${file.name}: ${message}`))
    onProgress(conversionEnd)
    return { processed: null, logs }
  }
}

export const useFileUpload = ({ onAuthenticated }: { onAuthenticated?: () => void }) => {
  const t = useTranslate()
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const isUploadingRef = useRef(false)

  const performUpload = useCallback(
    async ({ file, date }: { file: File; date: string }) => {
      await prepareUploadLocale()

      let targetDate: string | undefined
      try {
        targetDate = normalizeTargetDate(date)
      } catch {
        setUploadStatus({ level: 'error', message: t('common.invalidDateFormat') })
        return
      }

      const started = await beginUploadSession({
        isUploadingRef,
        onBegin: () => {
          setIsUploading(true)
          setProgress(0)
          setUploadStatus(null)
        },
      })
      if (!started) return

      try {
        setProgress(5)
        const auth = await ensureUploadAuth({ onAuthenticated })
        if (!auth.ok) {
          setProgress(100)
          setUploadStatus({ level: 'error', message: auth.message })
          return
        }

        setProgress(15)
        const { processed, logs: conversionLogs } = await convertFileLocally(file, setProgress, t)

        if (!processed) {
          setProgress(100)
          setUploadStatus(deriveUploadStatus(conversionLogs))
          return
        }

        setProgress(85)
        const reloadAfterUpload = await resolveReloadAfterUploadPreference()
        const response = (await browser.runtime.sendMessage({
          action: 'uploadProcessedFiles',
          files: [processed],
          targetDate,
        })) as { logs?: UploadLogEntry[]; ok?: boolean }

        const uploadLogs = response.logs ?? []
        if (hasUploadAuthError(uploadLogs)) {
          setProgress(100)
          setUploadStatus(
            deriveUploadStatus(
              await buildExpiredSessionLogs({ priorLogs: conversionLogs, uploadLogs }),
            ),
          )
          return
        }

        setProgress(100)
        setUploadStatus(deriveUploadStatus([...conversionLogs, ...uploadLogs]))
        if (response.ok) {
          invalidateOccupiedDatesCache()
        }
        await triggerEditorReloadIfNeeded({ reloadAfterUpload, uploadOk: response.ok })
      } catch (error) {
        setProgress(100)
        setUploadStatus({
          level: 'error',
          message: error instanceof Error ? error.message : t('upload.uploadError'),
        })
      } finally {
        endUploadSession({ isUploadingRef, onEnd: () => setIsUploading(false) })
      }
    },
    [onAuthenticated, t],
  )

  return {
    isUploading,
    progress,
    uploadStatus,
    performUpload,
  }
}
