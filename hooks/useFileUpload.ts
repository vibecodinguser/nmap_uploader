import { useCallback, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { normalizeDisplayTargetDate } from '@/lib/date_format'
import { ProcessingError } from '@/lib/errors'
import { isAllowedFile } from '@/lib/formats'
import { invalidateOccupiedDatesCache } from '@/lib/occupied_dates_cache'
import {
  resolveReloadAfterUploadPreference,
  triggerEditorReloadIfNeeded,
} from '@/lib/reload_after_upload'
import {
  buildExpiredSessionLogs,
  ensureUploadAuth,
  hasUploadAuthError,
} from '@/lib/upload_auth_flow'
import { createUploadLog, deriveUploadStatus, type UploadStatus } from '@/lib/upload_logs'
import type { UploadLogEntry } from '@/lib/upload_service'
import { beginUploadSession, endUploadSession } from '@/lib/upload_session'

export type { UploadStatus } from '@/lib/upload_logs'

const normalizeTargetDate = normalizeDisplayTargetDate

/** Конвертирует один файл в JSON-результат — без передачи бинарных данных в background. */
const convertFileLocally = async (file: File, onProgress: (percent: number) => void) => {
  const logs: UploadLogEntry[] = []
  const conversionEnd = 80

  if (!isAllowedFile(file.name)) {
    logs.push(createUploadLog('error', `✗ ${file.name}: неподдерживаемый формат`))
    onProgress(conversionEnd)
    return { processed: null, logs }
  }

  logs.push(createUploadLog('info', `Обработка: ${file.name}`))
  try {
    const { processFile } = await import('@/lib/converters')
    const result = await processFile({ name: file.name, buffer: await file.arrayBuffer() })
    logs.push(createUploadLog('success', `✓ ${file.name} сконвертирован`))
    onProgress(conversionEnd)
    return { processed: { name: file.name, result }, logs }
  } catch (error) {
    const message = error instanceof ProcessingError ? error.message : 'Неизвестная ошибка'
    logs.push(createUploadLog('error', `✗ ${file.name}: ${message}`))
    onProgress(conversionEnd)
    return { processed: null, logs }
  }
}

export const useFileUpload = ({ onAuthenticated }: { onAuthenticated?: () => void }) => {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const isUploadingRef = useRef(false)

  const performUpload = useCallback(
    async ({ file, date }: { file: File; date: string }) => {
      let targetDate: string | undefined
      try {
        targetDate = normalizeTargetDate(date)
      } catch {
        setUploadStatus({ level: 'error', message: 'Неверный формат даты' })
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
        const { processed, logs: conversionLogs } = await convertFileLocally(file, setProgress)

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
          message: error instanceof Error ? error.message : 'Ошибка при загрузке',
        })
      } finally {
        endUploadSession({ isUploadingRef, onEnd: () => setIsUploading(false) })
      }
    },
    [onAuthenticated],
  )

  return {
    isUploading,
    progress,
    uploadStatus,
    performUpload,
  }
}
