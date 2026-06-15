import { useCallback, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { normalizeDisplayTargetDate } from '@/lib/date_format'
import { invalidateOccupiedDatesCache } from '@/lib/occupied_dates_cache'
import {
  areCoordinatesValid,
  createPointIndex,
  processMultipointContent,
} from '@/lib/point_uploader'
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

export type PointUploadStatus = UploadStatus

const normalizeTargetDate = normalizeDisplayTargetDate

const uploadPointData = async ({
  files,
  targetDate,
}: {
  files: Array<{ name: string; result: ReturnType<typeof createPointIndex> }>
  targetDate?: string
}) =>
  (await browser.runtime.sendMessage({
    action: 'uploadProcessedFiles',
    files,
    targetDate,
  })) as { logs?: UploadLogEntry[]; ok?: boolean }

const applyUploadLogs = async ({
  priorLogs,
  uploadLogs,
  setUploadStatus,
}: {
  priorLogs: UploadLogEntry[]
  uploadLogs: UploadLogEntry[]
  setUploadStatus: (status: UploadStatus) => void
}) => {
  if (hasUploadAuthError(uploadLogs)) {
    setUploadStatus(deriveUploadStatus(await buildExpiredSessionLogs({ priorLogs, uploadLogs })))
    return
  }

  setUploadStatus(deriveUploadStatus([...priorLogs, ...uploadLogs]))
}

export type ManualPointInput = {
  description: string
  latitude: string
  longitude: string
  date: string
}

export const usePointUpload = ({ onAuthenticated }: { onAuthenticated?: () => void }) => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<PointUploadStatus | null>(null)
  const isUploadingRef = useRef(false)

  const runPointUpload = useCallback(
    async ({
      defaultErrorMessage,
      execute,
    }: {
      defaultErrorMessage: string
      execute: (reloadAfterUpload: boolean) => Promise<{
        priorLogs: UploadLogEntry[]
        uploadLogs: UploadLogEntry[]
        uploadOk: boolean | undefined
      } | null>
    }) => {
      const started = await beginUploadSession({
        isUploadingRef,
        onBegin: () => {
          setIsUploading(true)
          setUploadStatus(null)
        },
      })
      if (!started) return

      try {
        const auth = await ensureUploadAuth({ onAuthenticated })
        if (!auth.ok) {
          setUploadStatus({ level: 'error', message: auth.message })
          return
        }

        const reloadAfterUpload = await resolveReloadAfterUploadPreference()
        const result = await execute(reloadAfterUpload)
        if (!result) return

        await applyUploadLogs({
          priorLogs: result.priorLogs,
          uploadLogs: result.uploadLogs,
          setUploadStatus,
        })
        if (result.uploadOk) {
          invalidateOccupiedDatesCache()
        }
        await triggerEditorReloadIfNeeded({
          reloadAfterUpload,
          uploadOk: result.uploadOk,
        })
      } catch (error) {
        setUploadStatus({
          level: 'error',
          message: error instanceof Error ? error.message : defaultErrorMessage,
        })
      } finally {
        endUploadSession({ isUploadingRef, onEnd: () => setIsUploading(false) })
      }
    },
    [onAuthenticated],
  )

  const performManualUpload = useCallback(
    async ({ description, latitude, longitude, date }: ManualPointInput) => {
      const lat = Number.parseFloat(latitude.trim())
      const lon = Number.parseFloat(longitude.trim())

      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        setUploadStatus({ level: 'error', message: 'Координаты не указаны' })
        return
      }

      if (!areCoordinatesValid({ latitude: lat, longitude: lon })) {
        setUploadStatus({
          level: 'error',
          message: 'Координаты находятся вне допустимых диапазонов',
        })
        return
      }

      let targetDate: string | undefined
      try {
        targetDate = normalizeTargetDate(date)
      } catch {
        setUploadStatus({ level: 'error', message: 'Неверный формат даты' })
        return
      }

      await runPointUpload({
        defaultErrorMessage: 'Ошибка при загрузке точки',
        execute: async () => {
          const priorLogs = [createUploadLog('info', 'Подготовка точки')]
          const pointData = createPointIndex({
            latitude: lat,
            longitude: lon,
            description: description.trim(),
          })
          const response = await uploadPointData({
            files: [{ name: 'manual-point', result: pointData }],
            targetDate,
          })

          return {
            priorLogs,
            uploadLogs: response.logs ?? [],
            uploadOk: response.ok,
          }
        },
      })
    },
    [runPointUpload],
  )

  const performMultipointUpload = useCallback(
    async ({ files, date }: { files: File[]; date: string }) => {
      if (files.length === 0) {
        setUploadStatus({ level: 'error', message: 'Файлы не выбраны' })
        return
      }

      const invalidFile = files.find((file) => !file.name.toLowerCase().endsWith('.txt'))
      if (invalidFile) {
        setUploadStatus({ level: 'error', message: 'Только .txt файлы разрешены' })
        return
      }

      let targetDate: string | undefined
      try {
        targetDate = normalizeTargetDate(date)
      } catch {
        setUploadStatus({ level: 'error', message: 'Неверный формат даты' })
        return
      }

      await runPointUpload({
        defaultErrorMessage: 'Ошибка при загрузке точек',
        execute: async () => {
          const priorLogs: UploadLogEntry[] = []
          const processedFiles = await Promise.all(
            files.map(async (file) => {
              priorLogs.push(createUploadLog('info', `Обработка: ${file.name}`))
              const content = await file.text()
              const result = processMultipointContent(content)
              const pointCount = Object.keys(result.points).length
              if (pointCount === 0) {
                priorLogs.push(createUploadLog('error', `✗ ${file.name}: точки не найдены`))
              } else {
                priorLogs.push(createUploadLog('success', `✓ ${file.name}: ${pointCount} точек`))
              }
              return { name: file.name, result }
            }),
          )

          const validFiles = processedFiles.filter(
            (file) => Object.keys(file.result.points).length > 0,
          )
          if (validFiles.length === 0) {
            setUploadStatus({
              level: 'error',
              message: 'Не найдено точек в файлах (проверьте формат)',
            })
            return null
          }

          const response = await uploadPointData({ files: validFiles, targetDate })
          return {
            priorLogs,
            uploadLogs: response.logs ?? [],
            uploadOk: response.ok,
          }
        },
      })
    },
    [runPointUpload],
  )

  return {
    isUploading,
    uploadStatus,
    performManualUpload,
    performMultipointUpload,
  }
}
