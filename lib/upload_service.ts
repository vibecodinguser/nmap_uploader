import { ProcessingError } from './errors'
import { createNmapOutputTemplate, mergeNmapOutputTemplate, type ProcessResult } from './nmap_index'
import {
  downloadIndexJson,
  ensureStorageFolders,
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

const createLog = (level: UploadLogEntry['level'], message: string): UploadLogEntry => ({
  id: crypto.randomUUID(),
  level,
  message,
})

/** Загружает уже сконвертированные данные на Яндекс.Диск. */
export const uploadProcessedFilesToYandexDisk = async ({
  files,
}: {
  files: ProcessedFileInput[]
}): Promise<UploadFilesResult> => {
  const logs: UploadLogEntry[] = []
  const pushLog = (level: UploadLogEntry['level'], message: string) => {
    logs.push(createLog(level, message))
  }

  if (files.length === 0) {
    pushLog('error', 'Нет данных для загрузки')
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  const auth = await getStoredAuth()
  if (!auth) {
    pushLog('error', 'Необходима авторизация. Войдите через Яндекс ID')
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  const { token } = auth

  try {
    pushLog('info', 'Проверка доступа к Яндекс.Диску')
    await verifyDiskAccess({ token })
    pushLog('info', 'Проверка папок на Яндекс.Диске')
    await ensureStorageFolders({ token })
    pushLog('success', 'Папки готовы')
  } catch (error: unknown) {
    const message = error instanceof ProcessingError ? error.message : 'Ошибка доступа к Диску'
    pushLog('error', message)
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  let currentIndex = createNmapOutputTemplate()
  try {
    pushLog('info', 'Загрузка текущего index.json')
    const existing = await downloadIndexJson({ token })
    currentIndex = existing ?? createNmapOutputTemplate()
    pushLog('success', existing ? 'Текущий index.json загружен' : 'Создан новый index.json')
  } catch (error: unknown) {
    const message =
      error instanceof ProcessingError ? error.message : 'Не удалось загрузить index.json'
    pushLog('error', message)
    return { ok: false, logs, processedCount: 0, skippedCount: 0 }
  }

  let newData = createNmapOutputTemplate()
  for (const file of files) {
    newData = mergeNmapOutputTemplate(newData, file.result)
  }

  try {
    pushLog('info', 'Загрузка результатов в Блокнот картографа')
    const finalIndex = mergeNmapOutputTemplate(currentIndex, newData)
    await uploadIndexJson({ data: finalIndex, token })
    pushLog('success', 'index.json загружен на Яндекс.Диск')
  } catch (error: unknown) {
    const message = error instanceof ProcessingError ? error.message : 'Ошибка сохранения'
    pushLog('error', message)
    return { ok: false, logs, processedCount: files.length, skippedCount: 0 }
  }

  pushLog('success', 'Завершено: файл загружен')
  return { ok: true, logs, processedCount: 1, skippedCount: 0 }
}
