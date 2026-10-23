const URI_SCHEME = 'https'
const DISK_API_HOST = 'cloud-api.yandex.net/v1/disk'
const LOGIN_INFO_HOST = 'login.yandex.ru/info'
const MOCK_INDEX_DOWNLOADER_HOST = 'downloader.disk.yandex.ru/mock-index'
const MOCK_INDEX_UPLOADER_HOST = 'uploader.disk.yandex.ru/mock-index'
const AVATAR_API_HOST = 'avatars.yandex.net/get-yapic/*'

// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
export const DISK_API = URI_SCHEME + '://' + DISK_API_HOST
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
export const LOGIN_INFO = URI_SCHEME + '://' + LOGIN_INFO_HOST
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
export const MOCK_INDEX_DOWNLOADER = URI_SCHEME + '://' + MOCK_INDEX_DOWNLOADER_HOST
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
export const MOCK_INDEX_UPLOADER = URI_SCHEME + '://' + MOCK_INDEX_UPLOADER_HOST
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
export const AVATAR_API = URI_SCHEME + '://' + AVATAR_API_HOST

export const OAUTH_PREFIX_PATTERN = /^OAuth\s+/i
// biome-ignore lint/complexity/useRegexLiterals: '^disk:/' must not use // literal — confuses static analyzers
export const DISK_PREFIX_PATTERN = new RegExp('^disk:/')
export const LEADING_SLASHES_PATTERN = /^\/+/
export const TRAILING_SLASHES_PATTERN = /\/+$/
export const DATE_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const AVATAR_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])
export const DISK_APPLICATIONS_PATH = 'disk:/Приложения'

const createdPaths = new Set<string>()
const putFailureCounts = new Map<string, number>()
let indexJsonBody: Record<string, unknown> | null = null

export const getTokenFromAuth = (request: Request): string => {
  const auth = request.headers.get('Authorization') ?? ''
  const withoutOAuthPrefix = auth.replace(OAUTH_PREFIX_PATTERN, '')
  return withoutOAuthPrefix.trim()
}

export const isExpiredToken = (token: string): boolean => token === 'expired-token'

export function getRequestSearchParam(request: Request, paramName: string): string | null {
  const requestUrl = new URL(request.url)
  const searchParams = requestUrl.searchParams
  return searchParams.get(paramName)
}

/** Приводит path из API к единому виду (`/Приложения/...`). */
export function normalizeDiskPath(path: string): string {
  const withoutDiskPrefix = path.replace(DISK_PREFIX_PATTERN, '')
  const logical = withoutDiskPrefix.replace(LEADING_SLASHES_PATTERN, '')
  let normalized = '/'
  if (logical) {
    normalized = `/${logical}`
  }
  return normalized
}

/** Сбрасывает in-memory состояние моков Яндекс API между тестами. */
export const resetYandexMockState = () => {
  createdPaths.clear()
  putFailureCounts.clear()
  indexJsonBody = null
}

/** Возвращает нормализованные пути папок, созданных через PUT. */
export const getCreatedPaths = (): string[] => {
  const paths = [...createdPaths]
  return paths.sort()
}

export const simulateParentNotFoundOnPut = (path: string, attempts = 1): void => {
  const normalizedPath = normalizeDiskPath(path)
  putFailureCounts.set(normalizedPath, attempts)
}

export const getPutFailureAttempts = (normalizedPath: string): number => {
  return putFailureCounts.get(normalizedPath) ?? 0
}

export const decrementPutFailureAttempts = (normalizedPath: string, current: number): void => {
  putFailureCounts.set(normalizedPath, current - 1)
}

export const isDirectoryCreated = (path: string): boolean => {
  const normalizedPath = normalizeDiskPath(path)
  return createdPaths.has(normalizedPath)
}

export const markDirectoryCreated = (path: string): void => {
  const normalizedPath = normalizeDiskPath(path)
  createdPaths.add(normalizedPath)
}

export const getAllCreatedPaths = (): string[] => {
  return [...createdPaths]
}

export const getIndexJsonBody = (): Record<string, unknown> | null => indexJsonBody

/** Предзаполняет index.json на «Диске» для сценариев с существующим файлом. */
export const seedIndexJson = (data: Record<string, unknown>) => {
  indexJsonBody = data
}
