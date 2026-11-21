import { getHeaders, safeFetch, throwIfUnauthorized } from './auth'
import { API_BASE_URL } from './constants'
import { toDiskApiPath } from './disk_path_utils'

/**
 * Операции над ресурсами Яндекс.Диска, которых нет в адаптерах файлов и папок:
 * проверка существования произвольного пути и перенос каталога.
 *
 * Перенос нужен миграции заметок: папка со всеми шардами и иконками
 * переезжает одним запросом, без перечисления и повторной загрузки файлов.
 */

/** Проверяет, существует ли ресурс по логическому пути. */
export const diskResourceExists = async ({
  logicalPath,
  token,
}: {
  logicalPath: string
  token: string
}): Promise<boolean> => {
  const searchParams = new URLSearchParams({ path: toDiskApiPath(logicalPath) })
  const response = await safeFetch(`${API_BASE_URL}?${searchParams}`, {
    headers: getHeaders(token),
  })

  if (response.status === 404) {
    return false
  }
  throwIfUnauthorized(response.status, 'Проверка ресурса на Диске')
  if (!response.ok) {
    throw new Error(`Не удалось проверить ${logicalPath}: ${response.statusText}`)
  }

  return true
}

/** Переносит ресурс (файл или папку целиком) на новое место. */
export const moveDiskResource = async ({
  from,
  to,
  token,
  overwrite = false,
}: {
  from: string
  to: string
  token: string
  overwrite?: boolean
}): Promise<void> => {
  const searchParams = new URLSearchParams({
    from: toDiskApiPath(from),
    path: toDiskApiPath(to),
    overwrite: String(overwrite),
  })

  const response = await safeFetch(`${API_BASE_URL}/move?${searchParams}`, {
    method: 'POST',
    headers: getHeaders(token),
  })

  throwIfUnauthorized(response.status, 'Перенос ресурса на Диске')
  if (!response.ok) {
    throw new Error(`Не удалось перенести ${from} в ${to}: ${response.statusText}`)
  }
}
