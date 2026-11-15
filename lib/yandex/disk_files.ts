/**
 * Чтение и запись произвольных файлов на Яндекс.Диске.
 *
 * `disk_index_storage.ts` умеет только `index.json` Блокнота; заметкам нужен
 * общий адаптер для манифеста, шардов геометрии и файлов иконок.
 */
import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { getHeaders, safeFetch } from './auth'
import { API_BASE_URL } from './constants'
import { ensureFolderExists } from './disk_folder_ops'
import { getParentLogicalPath, toDiskApiPath } from './disk_path_utils'
import { assertAllowedDiskHref } from './disk_url'

type DiskFileRequest = { logicalPath: string; token: string }

/**
 * Задержки перед повтором загрузки.
 *
 * `423 LOCKED` значит, что файл занят другой записью (часто — собственной,
 * чуть более ранней). `503` — временная недоступность Диска. Оба случая
 * лечатся ожиданием, а не сообщением об ошибке пользователю.
 */
const UPLOAD_RETRY_DELAYS_MS = [200, 600, 1500]

const TRANSIENT_UPLOAD_STATUSES = new Set([423, 429, 503])

const isTransientUploadStatus = (status: number): boolean => TRANSIENT_UPLOAD_STATUSES.has(status)

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

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

/**
 * Папки, которые уже точно созданы, по отпечатку токена.
 *
 * Создание папки — отдельный запрос к API, а сохранение заметки пишет два
 * файла подряд. Кэш избавляет от лишних проверок, но не хранит сам токен:
 * только его отпечаток, чтобы смена аккаунта не переиспользовала чужой кэш.
 */
const ensuredFoldersByToken = new Map<string, Set<string>>()

const tokenFingerprint = (token: string): string => {
  let hash = 5381
  for (let index = 0; index < token.length; index += 1) {
    hash = ((hash << 5) + hash + token.charCodeAt(index)) | 0
  }
  return String(hash >>> 0)
}

const ensuredFoldersFor = (token: string): Set<string> => {
  const key = tokenFingerprint(token)
  let ensured = ensuredFoldersByToken.get(key)
  if (!ensured) {
    ensured = new Set()
    ensuredFoldersByToken.set(key, ensured)
  }
  return ensured
}

/**
 * Создаёт родительские папки файла.
 *
 * Без этого Яндекс.Диск отвечает на запрос ссылки на загрузку `409 CONFLICT`:
 * загружать файл в несуществующую папку нельзя.
 */
const ensureParentFolders = async ({ logicalPath, token }: DiskFileRequest): Promise<void> => {
  const parentPath = getParentLogicalPath(logicalPath)
  if (!parentPath) return

  const ensured = ensuredFoldersFor(token)
  if (ensured.has(parentPath)) return

  await ensureFolderExists({ path: parentPath, token })
  ensured.add(parentPath)
}

const requestUploadHref = async ({ logicalPath, token }: DiskFileRequest): Promise<Response> => {
  const searchParams = new URLSearchParams({
    path: toDiskApiPath(logicalPath),
    overwrite: 'true',
  })
  return safeFetch(`${API_BASE_URL}/upload?${searchParams}`, { headers: getHeaders(token) })
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
  await ensureParentFolders({ logicalPath, token })

  const payload = typeof body === 'string' ? new TextEncoder().encode(body) : body

  for (let attempt = 0; ; attempt += 1) {
    const meta = await requestUploadHref({ logicalPath, token })

    if (meta.status === 409) {
      // Папку удалили или ещё не создали: пересоздаём и пробуем снова.
      const parentPath = getParentLogicalPath(logicalPath)
      if (parentPath) {
        ensuredFoldersFor(token).delete(parentPath)
        await ensureParentFolders({ logicalPath, token })
      }
      if (attempt < UPLOAD_RETRY_DELAYS_MS.length) continue
      throw new ProcessingError(
        ERR_NETWORK,
        `Не удалось получить ссылку на загрузку ${logicalPath}: ${meta.statusText}`,
      )
    }

    if (isTransientUploadStatus(meta.status) && attempt < UPLOAD_RETRY_DELAYS_MS.length) {
      // `423 LOCKED` — файл занят другой записью; `503` — временная недоступность.
      await delay(UPLOAD_RETRY_DELAYS_MS[attempt])
      continue
    }

    if (!meta.ok) {
      throw new ProcessingError(
        ERR_NETWORK,
        `Не удалось получить ссылку на загрузку ${logicalPath}: ${meta.statusText}`,
      )
    }

    const { href } = (await meta.json()) as { href?: string }
    if (!href) {
      throw new ProcessingError(
        ERR_NETWORK,
        `Не удалось получить ссылку на загрузку ${logicalPath}`,
      )
    }

    assertAllowedDiskHref(href)

    const response = await safeFetch(href, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: payload as unknown as BodyInit,
    })

    if (response.ok) return

    if (isTransientUploadStatus(response.status) && attempt < UPLOAD_RETRY_DELAYS_MS.length) {
      await delay(UPLOAD_RETRY_DELAYS_MS[attempt])
      continue
    }

    throw new ProcessingError(ERR_NETWORK, `Ошибка загрузки ${logicalPath}: ${response.statusText}`)
  }
}
