import { HttpResponse, http } from 'msw'

const DISK_API = 'https://cloud-api.yandex.net/v1/disk'
const LOGIN_INFO = 'https://login.yandex.ru/info'

const createdPaths = new Set<string>()
let indexJsonBody: Record<string, unknown> | null = null

const getTokenFromAuth = (request: Request): string => {
  const auth = request.headers.get('Authorization') ?? ''
  return auth.replace(/^OAuth\s+/i, '').trim()
}

const isExpiredToken = (token: string): boolean => token === 'expired-token'

/** Сбрасывает in-memory состояние моков Яндекс API между тестами. */
export const resetYandexMockState = () => {
  createdPaths.clear()
  indexJsonBody = null
}

export const yandexHandlers = [
  http.get(`${DISK_API}/`, ({ request }) => {
    const token = getTokenFromAuth(request)
    if (isExpiredToken(token)) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json({ total_space: 10_000_000_000 })
  }),

  http.get(LOGIN_INFO, ({ request }) => {
    const token = getTokenFromAuth(request)
    if (isExpiredToken(token)) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json({
      id: '123',
      login: 'testuser',
      display_name: 'Test User',
    })
  }),

  http.get(`${DISK_API}/resources`, ({ request }) => {
    const token = getTokenFromAuth(request)
    if (isExpiredToken(token)) {
      return new HttpResponse(null, { status: 401 })
    }

    const path = new URL(request.url).searchParams.get('path')
    if (!path) {
      return new HttpResponse(null, { status: 400 })
    }

    if (path.endsWith('/index.json') && indexJsonBody) {
      return HttpResponse.json({ type: 'file', name: 'index.json', path })
    }

    if (createdPaths.has(path)) {
      return HttpResponse.json({ type: 'dir', name: path.split('/').pop(), path })
    }

    return new HttpResponse(null, { status: 404 })
  }),

  http.put(`${DISK_API}/resources`, ({ request }) => {
    const token = getTokenFromAuth(request)
    if (isExpiredToken(token)) {
      return new HttpResponse(null, { status: 401 })
    }

    const path = new URL(request.url).searchParams.get('path')
    if (!path) {
      return new HttpResponse(null, { status: 400 })
    }

    createdPaths.add(path)
    return new HttpResponse(null, { status: 201 })
  }),

  http.get(`${DISK_API}/resources/download`, ({ request }) => {
    const path = new URL(request.url).searchParams.get('path')
    if (path?.endsWith('/index.json') && indexJsonBody) {
      return HttpResponse.json({ href: 'https://downloader.disk.yandex.ru/mock-index' })
    }
    return new HttpResponse(null, { status: 404 })
  }),

  http.get('https://downloader.disk.yandex.ru/mock-index', () => {
    if (!indexJsonBody) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(indexJsonBody)
  }),

  http.get(`${DISK_API}/resources/upload`, ({ request }) => {
    const token = getTokenFromAuth(request)
    if (isExpiredToken(token)) {
      return new HttpResponse(null, { status: 401 })
    }

    const path = new URL(request.url).searchParams.get('path')
    if (!path?.endsWith('/index.json')) {
      return new HttpResponse(null, { status: 400 })
    }

    return HttpResponse.json({ href: 'https://uploader.disk.yandex.ru/mock-index' })
  }),

  http.put('https://uploader.disk.yandex.ru/mock-index', async ({ request }) => {
    indexJsonBody = (await request.json()) as Record<string, unknown>
    return new HttpResponse(null, { status: 201 })
  }),
]

/** Предзаполняет index.json на «Диске» для сценариев с существующим файлом. */
export const seedIndexJson = (data: Record<string, unknown>) => {
  indexJsonBody = data
}
