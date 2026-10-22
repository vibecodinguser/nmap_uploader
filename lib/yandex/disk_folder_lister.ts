import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { isValidTargetDate } from '@/lib/point_uploader'
import { safeFetch, throwIfUnauthorized } from './auth'
import { API_BASE_URL } from './constants'
import { toDiskApiPath } from './disk_path_utils'

const DATE_FOLDER_NAME_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DISK_LIST_PAGE_SIZE = 100

type DiskListItem = {
  name?: string
  type?: string
}

type DiskListResponse = {
  _embedded?: {
    items?: DiskListItem[]
    total?: number
    offset?: number
    limit?: number
  }
}

const isDateFolderName = (name: string): boolean =>
  DATE_FOLDER_NAME_PATTERN.test(name) && isValidTargetDate(name)

export const fetchDiskListOffset = async (
  basePath: string,
  headers: Record<string, string>,
  offset: number,
): Promise<{ newDates: string[]; nextOffset: number; hasMore: boolean }> => {
  const params = new URLSearchParams({
    path: toDiskApiPath(basePath),
    limit: String(DISK_LIST_PAGE_SIZE),
    offset: String(offset),
    fields:
      '_embedded.items.name,_embedded.items.type,_embedded.total,_embedded.offset,_embedded.limit',
  })

  const response = await safeFetch(`${API_BASE_URL}?${params}`, { headers })
  throwIfUnauthorized(response.status, 'Список папок на Диске')

  if (!response.ok) {
    if (response.status === 404) {
      return { newDates: [], nextOffset: offset, hasMore: false }
    }
    const detail = await response.text()
    let suffix = ''
    if (detail) {
      suffix = ` — ${detail}`
    }
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить список папок: ${response.statusText}${suffix}`,
    )
  }

  let data: DiskListResponse
  try {
    data = (await response.json()) as DiskListResponse
  } catch {
    throw new ProcessingError(ERR_NETWORK, 'Некорректный ответ Яндекс.Диска при чтении папок')
  }

  const items = data._embedded?.items ?? []
  const newDates: string[] = []
  for (const item of items) {
    const name = item.name?.trim()
    if (item.type === 'dir' && name && isDateFolderName(name)) {
      newDates.push(name)
    }
  }

  const total = data._embedded?.total ?? items.length
  const nextOffset = offset + items.length
  const hasMore = items.length > 0 && nextOffset < total

  return { newDates, nextOffset, hasMore }
}
