import { browser } from 'wxt/browser'
import { getNativeLocaleSnapshot } from '@/lib/i18n'
import { ensureUploadAuth } from './auth_flow'
import type { ProcessedFileInput, UploadAuthResult, UploadLogEntry } from './types'

export const defaultEnsureAuth = async ({
  onAuthenticated,
}: {
  onAuthenticated?: () => void
}): Promise<UploadAuthResult> => {
  return ensureUploadAuth({ onAuthenticated })
}

export const defaultUploadProcessedFiles = async ({
  processed,
  targetDate,
}: {
  processed: ProcessedFileInput
  targetDate?: string
}): Promise<{ logs?: UploadLogEntry[]; ok?: boolean }> => {
  return (await browser.runtime.sendMessage({
    action: 'uploadProcessedFiles',
    files: [processed],
    targetDate,
    // Фон живёт вне страницы редактора и языка панели не знает (ADR 0021).
    locale: getNativeLocaleSnapshot(),
  })) as { logs?: UploadLogEntry[]; ok?: boolean }
}
