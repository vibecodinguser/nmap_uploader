import { HttpResponse, http } from 'msw'
import {
  DATE_FOLDER_PATTERN,
  DISK_API,
  decrementPutFailureAttempts,
  getAllCreatedPaths,
  getIndexJsonBody,
  getPutFailureAttempts,
  getRequestSearchParam,
  getTokenFromAuth,
  isDirectoryCreated,
  isExpiredToken,
  markDirectoryCreated,
  normalizeDiskPath,
  TRAILING_SLASHES_PATTERN,
} from './yandex_mock_state'

function buildListPrefix(normalizedParent: string): string {
  let prefix = `${normalizedParent}/`
  if (normalizedParent === '/') {
    prefix = '/'
  }
  return prefix
}

function isDateChildFolder(candidate: string, prefix: string, normalizedParent: string): boolean {
  let isMatch = false
  if (candidate.startsWith(prefix) && candidate !== normalizedParent) {
    const relative = candidate.slice(prefix.length)
    const containsSlash = relative.includes('/')
    if (containsSlash) {
      isMatch = false
    } else {
      isMatch = DATE_FOLDER_PATTERN.test(relative)
    }
  }
  return isMatch
}

function lastPathSegment(path: string): string {
  const segments = path.split('/')
  const lastSegment = segments.pop()
  return lastSegment ?? ''
}

function listDateChildFolders(parentPath: string): string[] {
  const parentNormalized = normalizeDiskPath(parentPath)
  const withoutTrailingSlash = parentNormalized.replace(TRAILING_SLASHES_PATTERN, '')
  const normalizedParent = withoutTrailingSlash || '/'
  const prefix = buildListPrefix(normalizedParent)

  const folderNames: string[] = []
  const rawPaths = getAllCreatedPaths()
  for (const rawPath of rawPaths) {
    const normalizedCandidate = normalizeDiskPath(rawPath)
    const isCandidate = isDateChildFolder(normalizedCandidate, prefix, normalizedParent)
    if (isCandidate) {
      const folderName = lastPathSegment(normalizedCandidate)
      if (folderName) {
        folderNames.push(folderName)
      }
    }
  }

  return folderNames.sort()
}

function buildDirListItem(name: string, pathWithoutTrailingSlash: string) {
  return {
    type: 'dir',
    name,
    path: `${pathWithoutTrailingSlash}/${name}`,
  }
}

function buildDiskResourcesListResponse(
  request: Request,
  path: string,
  normalizedPath: string,
  limitParam: string,
): Response {
  let response: Response
  const dateFolders = listDateChildFolders(normalizedPath)
  const listingAvailable = dateFolders.length > 0 || isDirectoryCreated(path)

  if (listingAvailable) {
    const offsetParam = getRequestSearchParam(request, 'offset')
    const offset = Number(offsetParam ?? 0)
    const limit = Number(limitParam)
    const pathWithoutTrailingSlash = normalizedPath.replace(TRAILING_SLASHES_PATTERN, '')
    const pageSlice = dateFolders.slice(offset, offset + limit)
    const page = []
    for (const name of pageSlice) {
      const listItem = buildDirListItem(name, pathWithoutTrailingSlash)
      page.push(listItem)
    }
    response = HttpResponse.json({
      type: 'dir',
      _embedded: {
        items: page,
        limit,
        offset,
        total: dateFolders.length,
      },
    })
  } else {
    response = new HttpResponse(null, { status: 404 })
  }

  return response
}

function buildResourceMetaResponse(path: string, normalizedPath: string): Response {
  let response: Response
  const indexBody = getIndexJsonBody()
  const isIndexJson = normalizedPath.endsWith('/index.json') && indexBody

  if (isIndexJson) {
    response = HttpResponse.json({ type: 'file', name: 'index.json', path: normalizedPath })
  } else if (isDirectoryCreated(path)) {
    const directoryName = lastPathSegment(normalizedPath)
    response = HttpResponse.json({
      type: 'dir',
      name: directoryName,
      path: normalizedPath,
    })
  } else {
    response = new HttpResponse(null, { status: 404 })
  }

  return response
}

function buildDiskResourcesGetResponse(
  request: Request,
  path: string,
  normalizedPath: string,
): Response {
  let response: Response
  const limitParam = getRequestSearchParam(request, 'limit')
  if (limitParam) {
    response = buildDiskResourcesListResponse(request, path, normalizedPath, limitParam)
  } else {
    response = buildResourceMetaResponse(path, normalizedPath)
  }
  return response
}

function handleDiskResourcesGet({ request }: { request: Request }) {
  let response: Response
  const token = getTokenFromAuth(request)

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 })
  } else {
    const path = getRequestSearchParam(request, 'path')
    if (path) {
      const normalizedPath = normalizeDiskPath(path)
      response = buildDiskResourcesGetResponse(request, path, normalizedPath)
    } else {
      response = new HttpResponse(null, { status: 400 })
    }
  }

  return response
}

function handleDiskResourcesPut({ request }: { request: Request }) {
  let response: Response
  const token = getTokenFromAuth(request)

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 })
  } else {
    const path = getRequestSearchParam(request, 'path')
    if (path) {
      const normalizedPath = normalizeDiskPath(path)
      const failuresLeft = getPutFailureAttempts(normalizedPath)
      if (failuresLeft > 0) {
        decrementPutFailureAttempts(normalizedPath, failuresLeft)
        response = HttpResponse.json(
          {
            error: 'DiskPathDoesntExistsError',
            description: `Specified path "${path}" doesn't exists.`,
            message: `Указанного пути "${path}" не существует.`,
          },
          { status: 409 },
        )
      } else {
        markDirectoryCreated(path)
        response = new HttpResponse(null, { status: 201 })
      }
    } else {
      response = new HttpResponse(null, { status: 400 })
    }
  }

  return response
}

export const yandexResourceHandlers = [
  http.get(`${DISK_API}/resources`, handleDiskResourcesGet),
  http.put(`${DISK_API}/resources`, handleDiskResourcesPut),
]
