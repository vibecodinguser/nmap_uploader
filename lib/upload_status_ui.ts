import type { UploadLogEntry } from '@/lib/upload_service'

export const getUploadStatusClassName = (level: UploadLogEntry['level']): string => {
  if (level === 'error') return 'upload-progress-status upload-progress-status--error'
  if (level === 'success') return 'upload-progress-status upload-progress-status--success'
  return 'upload-progress-status'
}
