import type { UploadLogEntry } from '@/lib/upload_service'

export type UploadStatus = {
  level: UploadLogEntry['level']
  message: string
}

export const createUploadLog = (
  level: UploadLogEntry['level'],
  message: string,
): UploadLogEntry => ({
  id: crypto.randomUUID(),
  level,
  message,
})

export const deriveUploadStatus = (logs: UploadLogEntry[]): UploadStatus => {
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

export const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
