import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { browser } from 'wxt/browser'
import {
  areCoordinatesValid,
  createPointIndex,
  isValidTargetDate,
  processMultipointContent,
} from '@/lib/point_uploader'
import type { UploadLogEntry } from '@/lib/upload_service'
import { requestEnsureAuth } from '@/lib/yandex/auth_message'

const createLog = (level: UploadLogEntry['level'], message: string): UploadLogEntry => ({
  id: crypto.randomUUID(),
  level,
  message,
})

export type PointUploadStatus = {
  level: UploadLogEntry['level']
  message: string
}

const deriveUploadStatus = (logs: UploadLogEntry[]): PointUploadStatus => {
  const errorLog = [...logs].reverse().find((log) => log.level === 'error')
  if (errorLog) {
    return { level: 'error', message: errorLog.message }
  }

  const summaryLog = [...logs].reverse().find((log) => log.message.startsWith('Завершено:'))
  if (summaryLog) {
    return { level: 'success', message: summaryLog.message }
  }

  const successLog = [...logs].reverse().find((log) => log.level === 'success')
  return {
    level: 'success',
    message: successLog?.message ?? 'Загрузка завершена',
  }
}

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

const normalizeTargetDate = (date: string): string | undefined => {
  const trimmed = date.trim()
  if (!trimmed) return undefined
  if (!isValidTargetDate(trimmed)) {
    throw new Error('Неверный формат даты')
  }
  return trimmed
}

const uploadPointData = async ({
  files,
  targetDate,
  onProgress,
}: {
  files: Array<{ name: string; result: ReturnType<typeof createPointIndex> }>
  targetDate?: string
  onProgress: (percent: number) => void
}) => {
  onProgress(85)
  return (await browser.runtime.sendMessage({
    action: 'uploadProcessedFiles',
    files,
    targetDate,
  })) as { logs?: UploadLogEntry[]; ok?: boolean }
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

  const performManualUpload = useCallback(
    async ({ description, latitude, longitude, date }: ManualPointInput) => {
      if (isUploadingRef.current) return

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

      isUploadingRef.current = true
      flushSync(() => {
        setIsUploading(true)
        setUploadStatus(null)
      })
      await waitForNextFrame()

      const logs: UploadLogEntry[] = []

      try {
        const authResponse = await requestEnsureAuth({ interactive: true })
        if (!authResponse.ok) {
          const message =
            authResponse.error ??
            'Для загрузки нужен доступ к Яндекс.Диску. Разрешите запись в окне Яндекс ID'
          setUploadStatus({ level: 'error', message })
          return
        }

        onAuthenticated?.()
        logs.push(createLog('info', 'Подготовка точки'))

        const pointData = createPointIndex({
          latitude: lat,
          longitude: lon,
          description: description.trim(),
        })

        const response = await uploadPointData({
          files: [{ name: 'manual-point', result: pointData }],
          targetDate,
          onProgress: () => {},
        })

        const uploadLogs = response.logs ?? []
        const hasAuthError = uploadLogs.some(
          (log) =>
            log.level === 'error' &&
            (log.message.includes('сессия недействительна') ||
              log.message.includes('Выйдите и войдите')),
        )

        if (hasAuthError) {
          await browser.runtime.sendMessage({ action: 'logout' })
          setUploadStatus(
            deriveUploadStatus([
              ...logs,
              ...uploadLogs,
              createLog('error', 'Сессия истекла. Повторите загрузку для повторного входа'),
            ]),
          )
          return
        }

        setUploadStatus(deriveUploadStatus([...logs, ...uploadLogs]))
      } catch (error) {
        setUploadStatus({
          level: 'error',
          message: error instanceof Error ? error.message : 'Ошибка при загрузке точки',
        })
      } finally {
        isUploadingRef.current = false
        setIsUploading(false)
      }
    },
    [onAuthenticated],
  )

  const performMultipointUpload = useCallback(
    async ({ files, date }: { files: File[]; date: string }) => {
      if (isUploadingRef.current) return
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

      isUploadingRef.current = true
      flushSync(() => {
        setIsUploading(true)
        setUploadStatus(null)
      })
      await waitForNextFrame()

      const logs: UploadLogEntry[] = []

      try {
        const authResponse = await requestEnsureAuth({ interactive: true })
        if (!authResponse.ok) {
          const message =
            authResponse.error ??
            'Для загрузки нужен доступ к Яндекс.Диску. Разрешите запись в окне Яндекс ID'
          setUploadStatus({ level: 'error', message })
          return
        }

        onAuthenticated?.()

        const processedFiles = await Promise.all(
          files.map(async (file) => {
            logs.push(createLog('info', `Обработка: ${file.name}`))
            const content = await file.text()
            const result = processMultipointContent(content)
            const pointCount = Object.keys(result.points).length
            if (pointCount === 0) {
              logs.push(createLog('error', `✗ ${file.name}: точки не найдены`))
            } else {
              logs.push(createLog('success', `✓ ${file.name}: ${pointCount} точек`))
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
          return
        }

        const response = await uploadPointData({
          files: validFiles,
          targetDate,
          onProgress: () => {},
        })

        const uploadLogs = response.logs ?? []
        const hasAuthError = uploadLogs.some(
          (log) =>
            log.level === 'error' &&
            (log.message.includes('сессия недействительна') ||
              log.message.includes('Выйдите и войдите')),
        )

        if (hasAuthError) {
          await browser.runtime.sendMessage({ action: 'logout' })
          setUploadStatus(
            deriveUploadStatus([
              ...logs,
              ...uploadLogs,
              createLog('error', 'Сессия истекла. Повторите загрузку для повторного входа'),
            ]),
          )
          return
        }

        setUploadStatus(deriveUploadStatus([...logs, ...uploadLogs]))
      } catch (error) {
        setUploadStatus({
          level: 'error',
          message: error instanceof Error ? error.message : 'Ошибка при загрузке точек',
        })
      } finally {
        isUploadingRef.current = false
        setIsUploading(false)
      }
    },
    [onAuthenticated],
  )

  return {
    isUploading,
    uploadStatus,
    performManualUpload,
    performMultipointUpload,
  }
}
