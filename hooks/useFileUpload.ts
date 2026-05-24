import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { processFile } from '../lib/converters'
import { ProcessingError } from '../lib/errors'
import { isAllowedFile } from '../lib/formats'
import type { ProcessResult } from '../lib/nmap_index'
import type { UploadLogEntry } from '../lib/upload_service'
import { requestEnsureAuth } from '../lib/yandex/auth_message'

const createLog = (level: UploadLogEntry['level'], message: string): UploadLogEntry => ({
  id: crypto.randomUUID(),
  level,
  message,
})

export type UploadStatus = {
  level: UploadLogEntry['level']
  message: string
}

const deriveUploadStatus = (logs: UploadLogEntry[]): UploadStatus => {
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

/** Конвертирует один файл в JSON-результат — без передачи бинарных данных в background. */
const convertFileLocally = async (file: File, onProgress: (percent: number) => void) => {
  const logs: UploadLogEntry[] = []
  const conversionStart = 15
  const conversionEnd = 80

  if (!isAllowedFile(file.name)) {
    logs.push(createLog('error', `✗ ${file.name}: неподдерживаемый формат`))
    onProgress(conversionEnd)
    return { processed: null, logs }
  }

  logs.push(createLog('info', `Обработка: ${file.name}`))
  try {
    const result = await processFile({ name: file.name, buffer: await file.arrayBuffer() })
    logs.push(createLog('success', `✓ ${file.name} сконвертирован`))
    onProgress(conversionEnd)
    return { processed: { name: file.name, result }, logs }
  } catch (error) {
    const message = error instanceof ProcessingError ? error.message : 'Неизвестная ошибка'
    logs.push(createLog('error', `✗ ${file.name}: ${message}`))
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
    async (file: File) => {
      if (isUploadingRef.current) return

      isUploadingRef.current = true
      flushSync(() => {
        setIsUploading(true)
        setProgress(0)
        setUploadStatus(null)
      })
      await waitForNextFrame()

      try {
        setProgress(5)
        const authResponse = await requestEnsureAuth({ interactive: true })
        if (!authResponse.ok) {
          const message =
            authResponse.error ??
            'Для загрузки нужен доступ к Яндекс.Диску. Разрешите запись в окне Яндекс ID'
          setProgress(100)
          setUploadStatus({ level: 'error', message })
          return
        }

        onAuthenticated?.()
        setProgress(15)

        const { processed, logs: conversionLogs } = await convertFileLocally(file, setProgress)

        if (!processed) {
          setProgress(100)
          setUploadStatus(deriveUploadStatus(conversionLogs))
          return
        }

        setProgress(85)
        const response = (await browser.runtime.sendMessage({
          action: 'uploadProcessedFiles',
          files: [processed],
        })) as { logs?: UploadLogEntry[]; ok?: boolean }

        const uploadLogs = response.logs ?? []
        const hasAuthError = uploadLogs.some(
          (log) =>
            log.level === 'error' &&
            (log.message.includes('сессия недействительна') ||
              log.message.includes('Выйдите и войдите')),
        )

        if (hasAuthError) {
          await browser.runtime.sendMessage({ action: 'logout' })
          const finalLogs = [
            ...conversionLogs,
            ...uploadLogs,
            createLog('error', 'Сессия истекла. Повторите загрузку для повторного входа'),
          ]
          setProgress(100)
          setUploadStatus(deriveUploadStatus(finalLogs))
          return
        }

        setProgress(100)
        setUploadStatus(deriveUploadStatus([...conversionLogs, ...uploadLogs]))
      } catch (error) {
        setProgress(100)
        setUploadStatus({
          level: 'error',
          message: error instanceof Error ? error.message : 'Ошибка при загрузке',
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
    progress,
    uploadStatus,
    performUpload,
  }
}
