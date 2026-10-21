import type { ProcessResult } from '@/lib/nmap_index'

export type UploadLogLevel = 'info' | 'error' | 'success'

export type UploadLogEntry = {
  id: string
  level: UploadLogLevel
  message: string
}

export type ProcessedFileInput = {
  name: string
  result: ProcessResult
}

export type UploadResult = {
  ok: boolean
  logs: UploadLogEntry[]
  processedCount: number
  skippedCount: number
}

export type UploadStatus = {
  level: UploadLogLevel
  message: string
}

export type UploadAuthResult = { ok: true } | { ok: false; message: string }
