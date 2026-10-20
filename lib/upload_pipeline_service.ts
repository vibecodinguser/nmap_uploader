import { browser } from 'wxt/browser'
import { normalizeDisplayTargetDate } from '@/lib/date_format'
import { isAllowedFile } from '@/lib/formats'
import { processGeoFile } from '@/lib/geo_converters'
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
import {
  createUploadLog,
  deriveUploadStatus,
  type UploadStatus,
} from '@/lib/upload_logs'
import type { ProcessedFileInput, UploadLogEntry } from '@/lib/upload_service'

export const UPLOAD_PROGRESS = {
  reset: 0,
  authStart: 5,
  conversionStart: 15,
  conversionEnd: 80,
  uploadStart: 85,
  complete: 100,
} as const

export type UploadAuthResult = { ok: true } | { ok: false; message: string }

export type UploadPipelineDependencies = {
  ensureAuth: (input: { onAuthenticated?: () => void }) => Promise<UploadAuthResult>
  uploadProcessedFiles: (input: {
    processed: ProcessedFileInput
    targetDate?: string
  }) => Promise<{ logs?: UploadLogEntry[]; ok?: boolean }>
  invalidateCache: () => void
  triggerReload: (input: { reloadAfterUpload: boolean; uploadOk?: boolean }) => Promise<void>
  getReloadPreference: () => Promise<boolean>
  t: TranslateFn
}

export type ExecuteUploadPipelineInput = {
  file: File
  rawDate: string
  onProgress?: (percent: number) => void
  onAuthenticated?: () => void
  deps?: Partial<UploadPipelineDependencies>
}

export type UploadPipelineResult = {
  ok: boolean
  status: UploadStatus
  logs: UploadLogEntry[]
}

const defaultEnsureAuth = async ({
  onAuthenticated,
}: {
  onAuthenticated?: () => void
}): Promise<UploadAuthResult> => {
  await prepareUploadLocale()
  return ensureUploadAuth({ onAuthenticated })
}

const defaultUploadProcessedFiles = async ({
  processed,
  targetDate,
}: {
  processed: ProcessedFileInput
  targetDate?: string
}) => {
  return (await browser.runtime.sendMessage({
    action: 'uploadProcessedFiles',
    files: [processed],
    targetDate,
  })) as { logs?: UploadLogEntry[]; ok?: boolean }
}

export const executeUploadPipeline = async ({
  file,
  rawDate,
  onProgress = () => {},
  onAuthenticated,
  deps,
}: ExecuteUploadPipelineInput): Promise<UploadPipelineResult> => {
  const t = deps?.t ?? (((k: string) => k) as TranslateFn)
  const ensureAuth = deps?.ensureAuth ?? defaultEnsureAuth
  const uploadProcessedFiles = deps?.uploadProcessedFiles ?? defaultUploadProcessedFiles
  const invalidateCache = deps?.invalidateCache ?? invalidateOccupiedDatesCache
  const triggerReload = deps?.triggerReload ?? triggerEditorReloadIfNeeded
  const getReloadPreference =
    deps?.getReloadPreference ?? resolveReloadAfterUploadPreference

  const logs: UploadLogEntry[] = []

  // 1. Валидация даты
  let targetDate: string | undefined
  try {
    targetDate = normalizeDisplayTargetDate(rawDate)
  } catch {
    const errorStatus: UploadStatus = {
      level: 'error',
      message: t('common.invalidDateFormat'),
    }
    return { ok: false, status: errorStatus, logs }
  }

  // 2. Валидация расширения файла
  if (!isAllowedFile(file.name)) {
    const unsupportedMsg = t('upload.unsupportedFormat', { file: file.name })
    logs.push(createUploadLog('error', `✗ ${unsupportedMsg}`))
    return { ok: false, status: deriveUploadStatus(logs), logs }
  }

  // 3. Авторизация
  onProgress(UPLOAD_PROGRESS.authStart)
  const auth = await ensureAuth({ onAuthenticated })
  if (!auth.ok) {
    onProgress(UPLOAD_PROGRESS.complete)
    const authStatus: UploadStatus = {
      level: 'error',
      message: auth.message,
    }
    return { ok: false, status: authStatus, logs }
  }

  // 4. Конвертация геофайла (RORO + Result pattern)
  onProgress(UPLOAD_PROGRESS.conversionStart)
  logs.push(createUploadLog('info', t('upload.processing', { file: file.name })))

  const buffer = await file.arrayBuffer()
  const convertResult = await processGeoFile({
    buffer,
    fileName: file.name,
  })

  onProgress(UPLOAD_PROGRESS.conversionEnd)

  if (!convertResult.ok) {
    logs.push(createUploadLog('error', `✗ ${file.name}: ${convertResult.error.message}`))
    return { ok: false, status: deriveUploadStatus(logs), logs }
  }

  logs.push(createUploadLog('success', `✓ ${t('upload.converted', { file: file.name })}`))

  // 5. Отправка полезной нагрузки
  onProgress(UPLOAD_PROGRESS.uploadStart)
  const reloadAfterUpload = await getReloadPreference()

  const processed: ProcessedFileInput = {
    name: file.name,
    result: convertResult.value,
  }

  const uploadResponse = await uploadProcessedFiles({ processed, targetDate })
  const uploadLogs = uploadResponse.logs ?? []

  let mergedLogs: UploadLogEntry[]
  if (hasUploadAuthError(uploadLogs)) {
    mergedLogs = await buildExpiredSessionLogs({
      priorLogs: logs,
      uploadLogs,
    })
  } else {
    mergedLogs = [...logs, ...uploadLogs]
  }

  onProgress(UPLOAD_PROGRESS.complete)

  if (uploadResponse.ok) {
    invalidateCache()
  }

  await triggerReload({ reloadAfterUpload, uploadOk: uploadResponse.ok })

  return {
    ok: Boolean(uploadResponse.ok),
    status: deriveUploadStatus(mergedLogs),
    logs: mergedLogs,
  }
}
