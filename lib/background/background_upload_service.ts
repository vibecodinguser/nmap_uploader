/**
 * Сервис обработки загрузки файлов в фоновом режиме.
 */
import { getErrorMessage } from '@/lib/errors'
import { getBackgroundLocale } from '@/lib/i18n'
import type { ProcessedFileInput, UploadResult } from '@/lib/upload/types'
import { uploadProcessedFilesToYandexDisk } from '@/lib/upload/yandex_upload'
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
    const result = await uploadProcessedFilesToYandexDisk({
      files,
      targetDate,
      locale: getBackgroundLocale(message),
    })
    sendResponse(result)
  } catch (error: unknown) {
    console.error('[yamapper] upload failed:', error)
    const t = getBackgroundTranslator(getBackgroundLocale(message))
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
  locale?: unknown,
): Promise<void> => {
  const t = getBackgroundTranslator(getBackgroundLocale({ locale }))
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
