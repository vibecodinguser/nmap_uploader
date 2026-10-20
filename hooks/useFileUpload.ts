import { useCallback, useRef, useState } from 'react'
import { useTranslate } from '@/hooks/useLocale'
import type { UploadStatus } from '@/lib/upload_logs'
import { executeUploadPipeline } from '@/lib/upload_pipeline_service'
import { beginUploadSession, endUploadSession } from '@/lib/upload_session'

export type { UploadStatus } from '@/lib/upload_logs'

type UseFileUploadOptions = {
  onAuthenticated?(): void
}

type PerformUploadInput = {
  file: File
  date: string
}

export function useFileUpload({ onAuthenticated }: UseFileUploadOptions = {}) {
  const t = useTranslate()
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const isUploadingRef = useRef(false)

  const performUpload = useCallback(
    async ({ file, date }: PerformUploadInput) => {
      const onBegin = () => {
        setIsUploading(true)
        setProgress(0)
        setUploadStatus(null)
      }

      const started = await beginUploadSession({ isUploadingRef, onBegin })
      if (!started) return

      try {
        const result = await executeUploadPipeline({
          file,
          rawDate: date,
          onProgress: setProgress,
          onAuthenticated,
          deps: { t },
        })
        setUploadStatus(result.status)
      } catch (error) {
        setProgress(100)
        const message = error instanceof Error ? error.message : t('upload.uploadError')
        setUploadStatus({ level: 'error', message })
      } finally {
        const onEnd = () => setIsUploading(false)
        endUploadSession({ isUploadingRef, onEnd })
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
