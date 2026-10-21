import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import type { NmapIndex } from '@/lib/nmap_index'
import { isValidTargetDate } from '@/lib/point_uploader'
import { assertAllowedDiskHref } from '@/lib/yandex/disk_url'
import { getHeaders, safeFetch, throwIfUnauthorized } from './auth'
import { API_BASE_URL, YANDEX_DISK_FOLDER } from './constants'

const DISK_ROOT_PREFIX = '/'
const DISK_SCHEME_PREFIX = 'disk:/'
const APPLICATIONS_FOLDER = 'Приложения'

type DiskApiError = {
  error?: string
  message?: string
  description?: string
}

export const toDiskApiPath = (logicalPath: string): string => {
  if (!logicalPath) {
    return DISK_ROOT_PREFIX
  }
  if (logicalPath.startsWith('disk:/') || logicalPath.startsWith('app:/')) {
    return logicalPath
  }
  const noLeadingSlash = logicalPath.replace(/^\/+/, '')
  const normalized = noLeadingSlash.replace(/\/+$/, '')
  return `${DISK_ROOT_PREFIX}${normalized}`
}

export const fromDiskApiPath = (path: string): string => {
  const noDiskPrefix = path.replace(/^disk:\//, '')
  return noDiskPrefix.replace(/^\/+/, '')
}

export const getDiskApiPathVariants = (logicalPath: string): string[] => {
  const fromDiskPath = fromDiskApiPath(logicalPath)
  const normalized = fromDiskPath.replace(/\/+$/, '')
  if (!normalized) {
    const schemePrefix = DISK_SCHEME_PREFIX.slice(0, -1)
    return [DISK_ROOT_PREFIX, schemePrefix]
  }

  const slashPath = `${DISK_ROOT_PREFIX}${normalized}`
  const schemePath = `${DISK_SCHEME_PREFIX}${normalized}`
  if (slashPath === schemePath) {
    return [slashPath]
  }
  return [slashPath, schemePath]
}

const getParentLogicalPath = (logicalPath: string): string => {
  const fromDiskPath = fromDiskApiPath(logicalPath)
  const normalized = fromDiskPath.replace(/\/+$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash === -1) {
    return ''
  }
  return normalized.slice(0, lastSlash)
}

const isApplicationsFolder = (logicalPath: string): boolean => {
  const diskPath = fromDiskApiPath(logicalPath)
  return diskPath === APPLICATIONS_FOLDER
}

const parseDiskApiError = (body: string): DiskApiError => {
  try {
    return JSON.parse(body) as DiskApiError
  } catch {
    return {}
  }
}

const readDiskResponseError = async (
  response: Response,
): Promise<{ text: string; parsed: DiskApiError }> => {
  const text = await response.text()
  return { text, parsed: parseDiskApiError(text) }
}

const formatDiskResponseError = (response: Response, body: string): string => {
  let suffix = ''
  if (body) {
    suffix = ` — ${body}`
  }
  return `${response.status} ${response.statusText}${suffix}`
}

const isParentNotFound = (status: number, parsed: DiskApiError): boolean =>
  status === 404 || (status === 409 && parsed.error === 'DiskPathDoesntExistsError')

const isFolderAlreadyExists = (status: number, parsed: DiskApiError): boolean =>
  status === 409 &&
  (parsed.error === 'DiskPathPointsToExistentDirectoryError' ||
    parsed.error === 'DiskResourceAlreadyExistsError')

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

const createDirectoryAtPath = async ({
  apiPath,
  headers,
}: {
  apiPath: string
  headers: Record<string, string>
}): Promise<Response> => {
  const params = new URLSearchParams({ path: apiPath })
  return safeFetch(`${API_BASE_URL}?${params}`, { method: 'PUT', headers })
}

const ensureApplicationsFolder = async ({ token }: { token: string }): Promise<void> => {
  const headers = getHeaders(token)

  if (await directoryExistsOnDisk({ logicalPath: APPLICATIONS_FOLDER, headers })) {
    return
  }

  let lastError = ''

  for (const apiPath of getDiskApiPathVariants(APPLICATIONS_FOLDER)) {
    const createResponse = await createDirectoryAtPath({ apiPath, headers })
    if (createResponse.status === 201) {
      return
    }

    throwIfUnauthorized(createResponse.status, 'Создание папки на Диске')

    const { text: errorText, parsed } = await readDiskResponseError(createResponse)
    lastError = formatDiskResponseError(createResponse, errorText)

    if (isFolderAlreadyExists(createResponse.status, parsed)) {
      if (await checkDirectoryExists({ apiPath, headers })) {
        return
      }
    }
  }

  if (await directoryExistsOnDisk({ logicalPath: APPLICATIONS_FOLDER, headers })) {
    return
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `Не удалось создать папку «${APPLICATIONS_FOLDER}»: ` + `${lastError || 'неизвестная ошибка'}`,
  )
}

const throwIfForbidden = (status: number, path: string): void => {
  if (status !== 403) {
    return
  }
  const message = [
    `Нет доступа к Яндекс.Диску (${path}).`,
    'Проверьте права cloud_api:disk.write в OAuth-приложении и войдите заново',
  ].join(' ')
  throw new ProcessingError(ERR_NETWORK, message)
}

const handleMissingParent = async ({
  logicalPath,
  token,
  headers,
}: {
  logicalPath: string
  token: string
  headers: Record<string, string>
}): Promise<{ success: boolean; response?: Response; errorText?: string }> => {
  const parentPath = getParentLogicalPath(logicalPath)
  if (parentPath) {
    await createDirectorySegment({ logicalPath: parentPath, token })
  }

  let lastResponse: Response | undefined
  let lastErrorText: string | undefined

  const variants = getDiskApiPathVariants(logicalPath)
  for (const variantPath of variants) {
    const createResponse = await createDirectoryAtPath({ apiPath: variantPath, headers })
    if (createResponse.status === 201) {
      return { success: true }
    }

    const { text: errorText, parsed } = await readDiskResponseError(createResponse)

    const existsAlready = isFolderAlreadyExists(createResponse.status, parsed)
    if (existsAlready && (await checkDirectoryExists({ apiPath: variantPath, headers }))) {
      return { success: true }
    }

    lastResponse = createResponse
    lastErrorText = errorText

    if (!isParentNotFound(createResponse.status, parsed)) {
      return { success: false, response: lastResponse, errorText: lastErrorText }
    }
  }

  return { success: false, response: lastResponse, errorText: lastErrorText }
}

const createDirectorySegment = async ({
  logicalPath,
  token,
}: {
  logicalPath: string
  token: string
}): Promise<void> => {
  const headers = getHeaders(token)

  if (await directoryExistsOnDisk({ logicalPath, headers })) {
    return
  }

  if (isApplicationsFolder(logicalPath)) {
    await ensureApplicationsFolder({ token })
    return
  }

  const apiPath = toDiskApiPath(logicalPath)
  let createResponse = await createDirectoryAtPath({ apiPath, headers })
  if (createResponse.status === 201) {
    return
  }

  throwIfUnauthorized(createResponse.status, 'Создание папки на Диске')
  let { text: errorText, parsed } = await readDiskResponseError(createResponse)

  const existsAlready = isFolderAlreadyExists(createResponse.status, parsed)
  if (existsAlready && (await checkDirectoryExists({ apiPath, headers }))) {
    return
  }

  if (isParentNotFound(createResponse.status, parsed)) {
    const parentResult = await handleMissingParent({ logicalPath, token, headers })
    if (parentResult.success) {
      return
    }
    if (parentResult.response) {
      createResponse = parentResult.response
      errorText = parentResult.errorText || ''
    }
  }

  throwIfForbidden(createResponse.status, logicalPath)
  const errorMsg = formatDiskResponseError(createResponse, errorText)
  throw new ProcessingError(ERR_NETWORK, `Не удалось создать папку ${logicalPath}: ${errorMsg}`)
}

export const ensureFolderExists = async ({
  path,
  token,
}: {
  path: string
  token: string
}): Promise<void> => {
  const fromDiskPath = fromDiskApiPath(path)
  const logicalPath = fromDiskPath.replace(/\/+$/, '')
  if (logicalPath) {
    const splitSegments = logicalPath.split('/')
    const segments = splitSegments.filter(Boolean)
    let currentPath = ''

    for (const segment of segments) {
      if (currentPath) {
        currentPath = `${currentPath}/${segment}`
      } else {
        currentPath = segment
      }
      await createDirectorySegment({ logicalPath: currentPath, token })
    }
  }
}

export const resolveFolderPath = ({
  targetDate,
  includeToday = true,
}: {
  targetDate?: string
  includeToday?: boolean
}): string => {
  const basePath = YANDEX_DISK_FOLDER.replace(/\/+$/, '')

  if (targetDate) {
    return `${basePath}/${targetDate}`
  }

  if (includeToday) {
    const todayDate = new Date()
    const todayIso = todayDate.toISOString()
    const todayStr = todayIso.slice(0, 10)
    return `${basePath}/${todayStr}`
  }

  return basePath
}

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

const fetchDiskListOffset = async (
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

export const listExistingDateFolders = async ({ token }: { token: string }): Promise<string[]> => {
  const basePath = resolveFolderPath({ includeToday: false })
  const headers = getHeaders(token)
  const dates: string[] = []
  let currentOffset = 0
  let looping = true

  while (looping) {
    const result = await fetchDiskListOffset(basePath, headers, currentOffset)
    dates.push(...result.newDates)
    currentOffset = result.nextOffset
    looping = result.hasMore
  }

  return dates.sort()
}

export const ensureStorageFolders = async ({ token }: { token: string }): Promise<void> => {
  await ensureFolderExists({ path: resolveFolderPath({ includeToday: false }), token })
  await ensureFolderExists({ path: resolveFolderPath({ includeToday: true }), token })
}

export const ensureUploadFolder = async ({
  token,
  targetDate,
}: {
  token: string
  targetDate?: string
}): Promise<void> => {
  if (targetDate) {
    await ensureFolderExists({ path: resolveFolderPath({ targetDate }), token })
  } else {
    await ensureStorageFolders({ token })
  }
}

export const downloadIndexJson = async ({
  token,
  targetDate,
}: {
  token: string
  targetDate?: string
}): Promise<NmapIndex | null> => {
  const folderPath = resolveFolderPath({ targetDate, includeToday: targetDate === undefined })
  const filePath = `${folderPath}/index.json`
  const headers = getHeaders(token)

  const diskPath = toDiskApiPath(filePath)
  const searchParams = new URLSearchParams({ path: diskPath })
  const downloadMeta = await safeFetch(`${API_BASE_URL}/download?${searchParams}`, { headers })

  if (downloadMeta.status === 404) {
    return null
  }
  if (!downloadMeta.ok) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить index.json: ${downloadMeta.statusText}`,
    )
  }

  const { href } = (await downloadMeta.json()) as { href?: string }
  if (href === undefined || href === null || href === '') {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось получить ссылку на скачивание index.json')
  }

  assertAllowedDiskHref(href)
  const fileResponse = await safeFetch(href)
  if (!fileResponse.ok) {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось скачать index.json')
  }

  try {
    return (await fileResponse.json()) as NmapIndex
  } catch {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось разобрать index.json')
  }
}

export const uploadIndexJson = async ({
  data,
  token,
  targetDate,
}: {
  data: NmapIndex
  token: string
  targetDate?: string
}): Promise<void> => {
  const folderPath = resolveFolderPath({ targetDate, includeToday: targetDate === undefined })
  await ensureFolderExists({ path: folderPath, token })

  const filePath = `${folderPath}/index.json`
  const headers = getHeaders(token)

  const checkDiskPath = toDiskApiPath(filePath)
  const checkParams = new URLSearchParams({ path: checkDiskPath })
  const checkRes = await safeFetch(`${API_BASE_URL}?${checkParams}`, { headers })
  if (checkRes.ok) {
    const checkData = (await checkRes.json()) as { type?: string }
    if (checkData.type === 'dir') {
      throw new ProcessingError(ERR_NETWORK, `Конфликт: ${filePath} на Диске является папкой`)
    }
  }

  const uploadDiskPath = toDiskApiPath(filePath)
  const uploadParams = new URLSearchParams({ path: uploadDiskPath, overwrite: 'true' })
  const uploadMeta = await safeFetch(`${API_BASE_URL}/upload?${uploadParams}`, { headers })
  if (!uploadMeta.ok) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить URL загрузки: ${uploadMeta.statusText}`,
    )
  }

  const { href } = (await uploadMeta.json()) as { href?: string }
  if (href === undefined || href === null || href === '') {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось получить ссылку на загрузку index.json')
  }

  assertAllowedDiskHref(href)
  const jsonData = JSON.stringify(data, null, 2)
  const encoder = new TextEncoder()
  const encodedBody = encoder.encode(jsonData)
  const uploadResponse = await safeFetch(href, {
    method: 'PUT',
    body: encodedBody,
  })

  if (!uploadResponse.ok) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Ошибка загрузки index.json: ${uploadResponse.statusText}`,
    )
  }
}
