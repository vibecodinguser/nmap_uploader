/**
 * Сервис обработки загрузки файлов в фоновом режиме.
 */
import { getErrorMessage } from '@/lib/errors'
import {
  type ProcessedFileInput,
  type UploadResult,
  uploadProcessedFilesToYandexDisk,
} from '@/lib/upload_service'
import { getBackgroundTranslator } from './background_auth_service'

export const getUploadMessagePayload = (
  message: Record<string, unknown>,
): { files: ProcessedFileInput[]; targetDate?: string } => {
  let files: ProcessedFileInput[] = []
  if (Array.isArray(message.files)) {
    files = message.files as ProcessedFileInput[]
  }

  let targetDate: string | undefined
  if ('string' === typeof message.targetDate) {
    targetDate = message.targetDate
  }

  return { files, targetDate }
}

export const processUpload = async (
  message: Record<string, unknown>,
  sendResponse: (response: UploadResult) => void,
): Promise<void> => {
  try {
    const { files, targetDate } = getUploadMessagePayload(message)
    const result = await uploadProcessedFilesToYandexDisk({ files, targetDate })
    sendResponse(result)
  } catch (error: unknown) {
    console.error('[nmap_uploader] upload failed:', error)
    const t = await getBackgroundTranslator()
    const uploadErrorFallback = t('auth.uploadError')
    sendResponse({
      ok: false,
      processedCount: 0,
      skippedCount: 0,
      logs: [
        {
          id: crypto.randomUUID(),
          level: 'error',
          message: getErrorMessage(error, uploadErrorFallback),
        },
      ],
    })
  }
}

export const processUploadAccessDenied = async (
  sendResponse: (response: UploadResult) => void,
): Promise<void> => {
  const t = await getBackgroundTranslator()
  const accessDeniedMessage = t('common.accessDenied')
  sendResponse({
    ok: false,
    processedCount: 0,
    skippedCount: 0,
    logs: [
      {
        id: crypto.randomUUID(),
        level: 'error',
        message: accessDeniedMessage,
      },
    ],
  })
}
