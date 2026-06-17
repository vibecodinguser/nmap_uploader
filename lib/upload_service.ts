import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { getErrorMessage } from './errors'
import { createNmapOutputTemplate, mergeNmapOutputTemplate, type ProcessResult } from './nmap_index'
import { createUploadLog } from './upload_logs'
import {
  downloadIndexJson,
  ensureUploadFolder,
  getStoredAuth,
  uploadIndexJson,
  verifyDiskAccess,
} from './yandex/client'

export type UploadLogEntry = {
  id: string
  level: 'info' | 'error' | 'success'
  message: string
}

export type ProcessedFileInput = {
  name: string
  result: ProcessResult
}

export type UploadFilesResult = {
  ok: boolean
  logs: UploadLogEntry[]
  processedCount: number
  skippedCount: number
}

/** Загружает уже сконвертированные данные на Яндекс.Диск. */
export const uploadProcessedFilesToYandexDisk = async ({
  files,
  targetDate,
}: {
  files: ProcessedFileInput[]
  targetDate?: string
}): Promise<UploadFilesResult> => {
  const locale = await syncLocaleFromStorage()
  const t = createTranslator(locale)
  const logs: UploadLogEntry[] = []
  const pushLog = (level: UploadLogEntry['level'], message: string) => {
    logs.push(createUploadLog(level, message))
  }

  if (files.length === 0) {
    pushLog('error', t('upload.noDataToUpload'))
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  const auth = await getStoredAuth()
  if (!auth) {
    pushLog('error', t('upload.authRequired'))
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  const { token } = auth

  try {
    pushLog('info', t('upload.checkingDiskAccess'))
    await verifyDiskAccess({ token })
    pushLog('info', t('upload.checkingFolders'))
    await ensureUploadFolder({ token, targetDate })
    pushLog('success', t('upload.foldersReady'))
  } catch (error: unknown) {
    const message = getErrorMessage(error, t('upload.diskAccessError'))
    pushLog('error', message)
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  let currentIndex = createNmapOutputTemplate()
  try {
    pushLog('info', t('upload.loadingIndex'))
    const existing = await downloadIndexJson({ token, targetDate })
    currentIndex = existing ?? createNmapOutputTemplate()
    pushLog('success', existing ? t('upload.indexLoaded') : t('upload.indexCreated'))
  } catch (error: unknown) {
    const message = getErrorMessage(error, t('upload.indexLoadError'))
    pushLog('error', message)
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  let newData = createNmapOutputTemplate()
  for (const file of files) {
    newData = mergeNmapOutputTemplate(newData, file.result)
  }

  try {
    pushLog('info', t('upload.uploadingToNotebook'))
    const finalIndex = mergeNmapOutputTemplate(currentIndex, newData)
    await uploadIndexJson({ data: finalIndex, token, targetDate })
    pushLog('success', t('upload.indexUploaded'))
  } catch (error: unknown) {
    const message = getErrorMessage(error, t('upload.saveError'))
    pushLog('error', message)
    return { ok: false, logs, processedCount: files.length, skippedCount: 0 }
  }

  pushLog('success', t('upload.uploadCompleteSummary'))
  return { ok: true, logs, processedCount: 1, skippedCount: 0 }
}
