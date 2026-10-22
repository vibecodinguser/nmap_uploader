import type { NmapIndex } from '@/lib/nmap_index'
import { getHeaders } from './auth'
import { fetchDiskListOffset } from './disk_folder_lister'
import {
  ensureApplicationsFolder as ensureApps,
  ensureFolderExists as ensureFolder,
  resolveFolderPath as resolveFolder,
} from './disk_folder_ops'
import {
  downloadIndexJson as downloadIndex,
  uploadIndexJson as uploadIndex,
} from './disk_index_storage'
import {
  fromDiskApiPath,
  getDiskApiPathVariants,
  getParentLogicalPath,
  isApplicationsFolder,
  toDiskApiPath,
} from './disk_path_utils'

export * from './disk_folder_lister'
export * from './disk_folder_ops'
export * from './disk_index_storage'
export * from './disk_path_utils'
export {
  fromDiskApiPath,
  getDiskApiPathVariants,
  getParentLogicalPath,
  isApplicationsFolder,
  toDiskApiPath,
}

export const resolveFolderPath = resolveFolder
export const ensureFolderExists = ensureFolder
export const ensureApplicationsFolder = ensureApps

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
  const headers = getHeaders(token)
  return downloadIndex({ folderPath, headers })
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
  const headers = getHeaders(token)
  return uploadIndex({ data, folderPath, headers })
}
