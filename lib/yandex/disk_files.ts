/**
 * Чтение и запись произвольных файлов на Яндекс.Диске.
 *
 * `disk_index_storage.ts` умеет только `index.json` Блокнота; заметкам нужен
 * общий адаптер для манифеста, шардов геометрии и файлов иконок.
 */
import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { getHeaders, safeFetch } from './auth'
import { API_BASE_URL } from './constants'
import { toDiskApiPath } from './disk_path_utils'
import { assertAllowedDiskHref } from './disk_url'

type DiskFileRequest = { logicalPath: string; token: string }

const requestDownloadHref = async ({
  logicalPath,
  token,
}: DiskFileRequest): Promise<string | null> => {
  const searchParams = new URLSearchParams({ path: toDiskApiPath(logicalPath) })
  const meta = await safeFetch(`${API_BASE_URL}/download?${searchParams}`, {
    headers: getHeaders(token),
  })

  if (meta.status === 404) return null
  if (!meta.ok) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить ссылку на скачивание ${logicalPath}: ${meta.statusText}`,
    )
  }

  const { href } = (await meta.json()) as { href?: string }
  if (!href) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить ссылку на скачивание ${logicalPath}`,
    )
  }

  assertAllowedDiskHref(href)
  return href
}

/** Скачивает файл. `null` — файла нет (404), а не ошибка. */
export const downloadDiskFile = async ({
  logicalPath,
  token,
}: DiskFileRequest): Promise<Uint8Array | null> => {
  const href = await requestDownloadHref({ logicalPath, token })
  if (!href) return null

  const response = await safeFetch(href)
  if (!response.ok) {
    throw new ProcessingError(ERR_NETWORK, `Не удалось скачать ${logicalPath}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

export const downloadDiskText = async ({
  logicalPath,
  token,
}: DiskFileRequest): Promise<string | null> => {
  const bytes = await downloadDiskFile({ logicalPath, token })
  return bytes ? new TextDecoder().decode(bytes) : null
}

/** Записывает файл, создавая при необходимости папки по всему пути. */
export const uploadDiskFile = async ({
  logicalPath,
  token,
  body,
  contentType = 'application/octet-stream',
}: DiskFileRequest & {
  body: string | Uint8Array
  contentType?: string
}): Promise<void> => {
  const searchParams = new URLSearchParams({
    path: toDiskApiPath(logicalPath),
    overwrite: 'true',
  })
  const meta = await safeFetch(`${API_BASE_URL}/upload?${searchParams}`, {
    headers: getHeaders(token),
  })

  if (!meta.ok) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить ссылку на загрузку ${logicalPath}: ${meta.statusText}`,
    )
  }

  const { href } = (await meta.json()) as { href?: string }
  if (!href) {
    throw new ProcessingError(ERR_NETWORK, `Не удалось получить ссылку на загрузку ${logicalPath}`)
  }

  assertAllowedDiskHref(href)

  const payload = typeof body === 'string' ? new TextEncoder().encode(body) : body
  const response = await safeFetch(href, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: payload as unknown as BodyInit,
  })

  if (!response.ok) {
    throw new ProcessingError(ERR_NETWORK, `Ошибка загрузки ${logicalPath}: ${response.statusText}`)
  }
}
