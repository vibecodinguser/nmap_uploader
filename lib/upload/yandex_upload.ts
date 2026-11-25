import { resolveDiskAccess } from '@/lib/background/disk_access'
import { getErrorMessage } from '@/lib/errors'
import { createTranslator, type Locale } from '@/lib/i18n'
import { createNmapOutputTemplate, mergeNmapOutputTemplate } from '@/lib/nmap_index'
import { PERMISSION_REQUIRED } from '@/lib/notes/storage/errors'
import {
  downloadIndexJson,
  ensureUploadFolder,
  uploadIndexJson,
  verifyDiskAccess,
} from '@/lib/yandex/client'
import { createUploadLog } from './logs'
import type { ProcessedFileInput, UploadLogEntry, UploadResult } from './types'

/** Загружает уже сконвертированные данные на Яндекс.Диск. */
export const uploadProcessedFilesToYandexDisk = async ({
  files,
  targetDate,
  locale,
}: {
  files: ProcessedFileInput[]
  targetDate?: string
  /** Язык панели, отправившей загрузку: фон своего DOM редактора не видит. */
  locale: Locale
}): Promise<UploadResult> => {
  const t = createTranslator(locale)
  const logs: UploadLogEntry[] = []
  const pushLog = (level: UploadLogEntry['level'], message: string) => {
    logs.push(createUploadLog(level, message))
  }

  if (files.length === 0) {
    pushLog('error', t('upload.noDataToUpload'))
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  const access = await resolveDiskAccess()
  if (!access.ok) {
    const errorKey =
      access.error === PERMISSION_REQUIRED ? 'upload.authDiskRequired' : 'upload.authRequired'
    pushLog('error', t(errorKey))
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  const { token } = access

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
