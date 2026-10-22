import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { safeFetch, throwIfUnauthorized } from './auth'
import { API_BASE_URL } from './constants'
import { fromDiskApiPath, getDiskApiPathVariants } from './disk_path_utils'

/**
 * Проверяет наличие директории на Яндекс.Диске по прямому apiPath.
 */
export const checkDirectoryExists = async ({
  apiPath,
  headers,
}: {
  apiPath: string
  headers: Record<string, string>
}): Promise<boolean> => {
  const params = new URLSearchParams({ path: apiPath })
  const response = await safeFetch(`${API_BASE_URL}?${params}`, { headers })
  throwIfUnauthorized(response.status, 'Проверка папки на Диске')
  if (!response.ok) {
    return false
  }

  let data: { type?: string }
  try {
    data = (await response.json()) as { type?: string }
  } catch {
    const diskPath = fromDiskApiPath(apiPath)
    throw new ProcessingError(ERR_NETWORK, `Некорректный ответ Яндекс.Диска для ${diskPath}`)
  }

  if (data.type === 'file') {
    const diskPath = fromDiskApiPath(apiPath)
    throw new ProcessingError(ERR_NETWORK, `Конфликт: по пути ${diskPath} уже существует файл`)
  }
  return data.type === 'dir'
}

/**
 * Проверяет существование директории на Яндекс.Диске, проверяя все возможные варианты API-пути.
 */
export const directoryExistsOnDisk = async ({
  logicalPath,
  headers,
}: {
  logicalPath: string
  headers: Record<string, string>
}): Promise<boolean> => {
  for (const apiPath of getDiskApiPathVariants(logicalPath)) {
    if (await checkDirectoryExists({ apiPath, headers })) {
      return true
    }
  }
  return false
}

/**
 * Отправляет PUT-запрос на создание директории по указанному apiPath.
 */
export const createDirectoryAtPath = async ({
  apiPath,
  headers,
}: {
  apiPath: string
  headers: Record<string, string>
}): Promise<Response> => {
  const params = new URLSearchParams({ path: apiPath })
  return safeFetch(`${API_BASE_URL}?${params}`, { method: 'PUT', headers })
}
