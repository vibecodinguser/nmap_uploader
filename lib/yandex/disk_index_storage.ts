import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import type { NmapIndex } from '@/lib/nmap_index'
import { assertAllowedDiskHref } from '@/lib/yandex/disk_url'
import { safeFetch } from './auth'
import { API_BASE_URL } from './constants'
import { toDiskApiPath } from './disk_path_utils'

export const downloadIndexJson = async ({
  folderPath,
  headers,
}: {
  folderPath: string
  headers: Record<string, string>
}): Promise<NmapIndex | null> => {
  const filePath = `${folderPath}/index.json`
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
  folderPath,
  headers,
}: {
  data: NmapIndex
  folderPath: string
  headers: Record<string, string>
}): Promise<void> => {
  const filePath = `${folderPath}/index.json`
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
