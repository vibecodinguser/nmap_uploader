import { browser } from 'wxt/browser'
import { ensureUploadAuth, prepareUploadLocale } from './auth_flow'
import type { ProcessedFileInput, UploadAuthResult, UploadLogEntry } from './types'

export const defaultEnsureAuth = async ({
  onAuthenticated,
}: {
  onAuthenticated?: () => void
}): Promise<UploadAuthResult> => {
  await prepareUploadLocale()
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
  })) as { logs?: UploadLogEntry[]; ok?: boolean }
}
