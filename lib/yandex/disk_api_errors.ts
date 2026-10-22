export type DiskApiError = {
  error?: string
  message?: string
  description?: string
}

export const parseDiskApiError = (body: string): DiskApiError => {
  try {
    return JSON.parse(body) as DiskApiError
  } catch {
    return {}
  }
}

export const readDiskResponseError = async (
  response: Response,
): Promise<{ text: string; parsed: DiskApiError }> => {
  const text = await response.text()
  return { text, parsed: parseDiskApiError(text) }
}

export const formatDiskResponseError = (response: Response, body: string): string => {
  let suffix = ''
  if (body) {
    suffix = ` — ${body}`
  }
  return `${response.status} ${response.statusText}${suffix}`
}

export const isParentNotFound = (status: number, parsed: DiskApiError): boolean =>
  status === 404 || (status === 409 && parsed.error === 'DiskPathDoesntExistsError')

export const isFolderAlreadyExists = (status: number, parsed: DiskApiError): boolean =>
  status === 409 &&
  (parsed.error === 'DiskPathPointsToExistentDirectoryError' ||
    parsed.error === 'DiskResourceAlreadyExistsError')
