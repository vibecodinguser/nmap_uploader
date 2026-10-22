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
import { resolveFolderPath } from './disk_path_resolver'
import {
  APPLICATIONS_FOLDER,
  fromDiskApiPath,
  getDiskApiPathVariants,
  getParentLogicalPath,
  isApplicationsFolder,
  toDiskApiPath,
} from './disk_path_utils'

export * from './disk_api_errors'
export * from './disk_dir_client'
export * from './disk_path_resolver'

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
