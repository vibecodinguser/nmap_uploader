import { HttpResponse, http } from 'msw'

const DISK_API = 'https://cloud-api.yandex.net/v1/disk'
const LOGIN_INFO = 'https://login.yandex.ru/info'
const DISK_APPLICATIONS_PATH = 'disk:/Приложения'

const createdPaths = new Set<string>()
const putFailureCounts = new Map<string, number>()
let indexJsonBody: Record<string, unknown> | null = null

const getTokenFromAuth = (request: Request): string => {
  const auth = request.headers.get('Authorization') ?? ''
  return auth.replace(/^OAuth\s+/i, '').trim()
}

const isExpiredToken = (token: string): boolean => token === 'expired-token'

/** Приводит path из API к единому виду (`/Приложения/...`). */
export const normalizeDiskPath = (path: string): string => {
  const logical = path.replace(/^disk:\//, '').replace(/^\/+/, '')
  return logical ? `/${logical}` : '/'
}

/** Сбрасывает in-memory состояние моков Яндекс API между тестами. */
export const resetYandexMockState = () => {
  createdPaths.clear()
  putFailureCounts.clear()
  indexJsonBody = null
}

/** Возвращает нормализованные пути папок, созданных через PUT. */
export const getCreatedPaths = (): string[] => [...createdPaths].sort()

/**
 * Симулирует ответ 409 DiskPathDoesntExistsError для следующих N попыток PUT.
 * Используется в тестах создания вложенных папок.
 */
export const simulateParentNotFoundOnPut = (path: string, attempts = 1): void => {
  putFailureCounts.set(normalizeDiskPath(path), attempts)
}

const isDirectoryCreated = (path: string): boolean => createdPaths.has(normalizeDiskPath(path))

const markDirectoryCreated = (path: string): void => {
  createdPaths.add(normalizeDiskPath(path))
}

export const yandexHandlers = [
  http.get(`${DISK_API}/`, ({ request }) => {
    const token = getTokenFromAuth(request)
    if (isExpiredToken(token)) {
      return new HttpResponse(null, { status: 401 })
    }

    const fields = new URL(request.url).searchParams.get('fields')
    if (fields?.includes('system_folders')) {
      return HttpResponse.json({
        system_folders: { applications: DISK_APPLICATIONS_PATH },
      })
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

    const normalizedPath = normalizeDiskPath(path)

    if (normalizedPath.endsWith('/index.json') && indexJsonBody) {
      return HttpResponse.json({ type: 'file', name: 'index.json', path: normalizedPath })
    }

    if (isDirectoryCreated(path)) {
      return HttpResponse.json({
        type: 'dir',
        name: normalizedPath.split('/').pop(),
        path: normalizedPath,
      })
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

    const normalizedPath = normalizeDiskPath(path)
    const failuresLeft = putFailureCounts.get(normalizedPath) ?? 0
    if (failuresLeft > 0) {
      putFailureCounts.set(normalizedPath, failuresLeft - 1)
      return HttpResponse.json(
        {
          error: 'DiskPathDoesntExistsError',
          description: `Specified path "${path}" doesn't exists.`,
          message: `Указанного пути "${path}" не существует.`,
        },
        { status: 409 },
      )
    }

    markDirectoryCreated(path)
    return new HttpResponse(null, { status: 201 })
  }),

  http.get(`${DISK_API}/resources/download`, ({ request }) => {
    const path = new URL(request.url).searchParams.get('path')
    if (path && normalizeDiskPath(path).endsWith('/index.json') && indexJsonBody) {
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
    if (!path || !normalizeDiskPath(path).endsWith('/index.json')) {
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
