import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { getHeaders, safeFetch, throwIfUnauthorized } from './auth'
import { API_BASE_URL, YANDEX_DISK_FOLDER } from './constants'
import {
  APPLICATIONS_FOLDER,
  fromDiskApiPath,
  getDiskApiPathVariants,
  getParentLogicalPath,
  isApplicationsFolder,
  toDiskApiPath,
} from './disk_path_utils'

type DiskApiError = {
  error?: string
  message?: string
  description?: string
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

export const ensureApplicationsFolder = async ({ token }: { token: string }): Promise<void> => {
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
    `Не удалось создать папку «${APPLICATIONS_FOLDER}»: ${lastError || 'неизвестная ошибка'}`,
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
