import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { getHeaders, throwIfUnauthorized } from './auth'
import {
  formatDiskResponseError,
  isFolderAlreadyExists,
  isParentNotFound,
  readDiskResponseError,
} from './disk_api_errors'
import {
  checkDirectoryExists,
  createDirectoryAtPath,
  directoryExistsOnDisk,
} from './disk_dir_client'
import {
  getDiskApiPathVariants,
  getParentLogicalPath,
  isApplicationsFolder,
  toDiskApiPath,
} from './disk_path_utils'

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
  ensureAppFolder,
}: {
  logicalPath: string
  token: string
  headers: Record<string, string>
  ensureAppFolder: (args: { token: string }) => Promise<void>
}): Promise<{ success: boolean; response?: Response; errorText?: string }> => {
  const parentPath = getParentLogicalPath(logicalPath)
  if (parentPath) {
    await createDirectorySegment({ logicalPath: parentPath, token, ensureAppFolder })
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

export const createDirectorySegment = async ({
  logicalPath,
  token,
  ensureAppFolder,
}: {
  logicalPath: string
  token: string
  ensureAppFolder: (args: { token: string }) => Promise<void>
}): Promise<void> => {
  const headers = getHeaders(token)

  if (await directoryExistsOnDisk({ logicalPath, headers })) {
    return
  }

  if (isApplicationsFolder(logicalPath)) {
    await ensureAppFolder({ token })
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
    const parentResult = await handleMissingParent({ logicalPath, token, headers, ensureAppFolder })
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
