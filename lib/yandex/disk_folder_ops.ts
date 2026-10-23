import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { getHeaders, throwIfUnauthorized } from './auth'
import {
  formatDiskResponseError,
  isFolderAlreadyExists,
  readDiskResponseError,
} from './disk_api_errors'
import {
  checkDirectoryExists,
  createDirectoryAtPath,
  directoryExistsOnDisk,
} from './disk_dir_client'
import { resolveFolderPath } from './disk_path_resolver'
import { APPLICATIONS_FOLDER, fromDiskApiPath, getDiskApiPathVariants } from './disk_path_utils'
import { createDirectorySegment } from './disk_segment_creator'

export * from './disk_api_errors'
export * from './disk_dir_client'
export * from './disk_path_resolver'
export * from './disk_segment_creator'

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
      await createDirectorySegment({
        logicalPath: currentPath,
        token,
        ensureAppFolder: ensureApplicationsFolder,
      })
    }
  }
}
