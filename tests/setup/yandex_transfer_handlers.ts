import { HttpResponse, http } from 'msw'
import {
  AVATAR_API,
  AVATAR_PNG,
  DISK_API,
  getIndexJsonBody,
  getRequestSearchParam,
  getTokenFromAuth,
  isExpiredToken,
  MOCK_INDEX_DOWNLOADER,
  MOCK_INDEX_UPLOADER,
  normalizeDiskPath,
  seedIndexJson,
} from './yandex_mock_state'

function handleDiskResourcesDownloadGet({ request }: { request: Request }) {
  let response: Response = new HttpResponse(null, { status: 404 })
  const path = getRequestSearchParam(request, 'path')

  if (path) {
    const normalizedDownloadPath = normalizeDiskPath(path)
    const indexBody = getIndexJsonBody()
    if (normalizedDownloadPath.endsWith('/index.json') && indexBody) {
      response = HttpResponse.json({ href: MOCK_INDEX_DOWNLOADER })
    }
  }

  return response
}

function handleMockIndexDownloadGet() {
  let response: Response
  const indexBody = getIndexJsonBody()

  if (indexBody) {
    response = HttpResponse.json(indexBody)
  } else {
    response = new HttpResponse(null, { status: 404 })
  }

  return response
}

function handleDiskResourcesUploadGet({ request }: { request: Request }) {
  let response: Response
  const token = getTokenFromAuth(request)

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 })
  } else {
    const path = getRequestSearchParam(request, 'path')
    if (path) {
      const normalizedUploadPath = normalizeDiskPath(path)
      if (normalizedUploadPath.endsWith('/index.json')) {
        response = HttpResponse.json({ href: MOCK_INDEX_UPLOADER })
      } else {
        response = new HttpResponse(null, { status: 400 })
      }
    } else {
      response = new HttpResponse(null, { status: 400 })
    }
  }

  return response
}

async function handleMockIndexUploadPut({ request }: { request: Request }) {
  const body = (await request.json()) as Record<string, unknown>
  seedIndexJson(body)
  return new HttpResponse(null, { status: 201 })
}

function handleAvatarGet() {
  return new HttpResponse(AVATAR_PNG, {
    headers: { 'Content-Type': 'image/png' },
  })
}

export const yandexTransferHandlers = [
  http.get(`${DISK_API}/resources/download`, handleDiskResourcesDownloadGet),
  http.get(MOCK_INDEX_DOWNLOADER, handleMockIndexDownloadGet),
  http.get(`${DISK_API}/resources/upload`, handleDiskResourcesUploadGet),
  http.put(MOCK_INDEX_UPLOADER, handleMockIndexUploadPut),
  http.get(AVATAR_API, handleAvatarGet),
]
