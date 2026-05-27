import { browser } from 'wxt/browser'
import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import type { NmapIndex } from '@/lib/nmap_index'

export const YANDEX_CLIENT_ID = 'ef45c7e176e844c087bc2487985ad275'
export const YANDEX_DISK_FOLDER = 'Приложения/Блокнот картографа Народной карты'
/** Scope должны совпадать с «Доступ к данным» в oauth.yandex.ru (см. /client/<id>/info). */
export const YANDEX_DISK_SCOPES = [
  'login:avatar',
  'cloud_api:disk.read',
  'cloud_api:disk.write',
].join(' ')
const API_BASE_URL = 'https://cloud-api.yandex.net/v1/disk/resources'

export type YandexUser = {
  id: string
  login: string
  display_name?: string
  real_name?: string
  default_avatar_id?: string
}

const getHeaders = (token: string): Record<string, string> => ({
  Authorization: `OAuth ${token.trim()}`,
  'Content-Type': 'application/json',
})

/** Проверяет, что токен действителен для REST API Яндекс.Диска. */
export const verifyDiskAccess = async ({ token }: { token: string }): Promise<void> => {
  const response = await safeFetch('https://cloud-api.yandex.net/v1/disk/?fields=total_space', {
    headers: getHeaders(token),
  })

  if (response.status === 401) {
    throw new ProcessingError(
      ERR_NETWORK,
      'Токен не принят Яндекс.Диском. Выйдите и войдите заново — нужен новый токен с правом cloud_api:disk.write',
    )
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new ProcessingError(
      ERR_NETWORK,
      `Яндекс.Диск недоступен: ${response.statusText}${detail ? ` — ${detail}` : ''}`,
    )
  }
}

const assertDiskWriteScope = (scope: string): void => {
  if (scope.includes('cloud_api:disk.write')) return

  throw new ProcessingError(
    ERR_NETWORK,
    `Токен выдан без права записи на Диск (scope: ${scope || 'не указан'}). Выйдите и войдите заново после добавления cloud_api:disk.write в OAuth-приложении`,
  )
}

const throwIfUnauthorized = (status: number, context: string): void => {
  if (status !== 401) return

  throw new ProcessingError(
    ERR_NETWORK,
    `${context}: сессия недействительна. Выйдите и войдите через Яндекс ID заново`,
  )
}

const DISK_ROOT_PREFIX = '/'
const DISK_SCHEME_PREFIX = 'disk:/'
const APPLICATIONS_FOLDER = 'Приложения'

type DiskApiError = {
  error?: string
  message?: string
  description?: string
}

const safeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init)
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'сеть недоступна'
    throw new ProcessingError(ERR_NETWORK, `Запрос к Яндекс.Диску не выполнен: ${detail}`)
  }
}

/** Преобразует логический путь в формат REST API Яндекс.Диска. */
const toDiskApiPath = (logicalPath: string): string => {
  if (!logicalPath) return DISK_ROOT_PREFIX
  if (logicalPath.startsWith('disk:/') || logicalPath.startsWith('app:/')) return logicalPath
  const normalized = logicalPath.replace(/^\/+/, '').replace(/\/+$/, '')
  return `${DISK_ROOT_PREFIX}${normalized}`
}

/** Варианты path для одного логического пути — API принимает и `/`, и `disk:/`. */
const getDiskApiPathVariants = (logicalPath: string): string[] => {
  const normalized = fromDiskApiPath(logicalPath).replace(/\/+$/, '')
  if (!normalized) return [DISK_ROOT_PREFIX, DISK_SCHEME_PREFIX.slice(0, -1)]

  const slashPath = `${DISK_ROOT_PREFIX}${normalized}`
  const schemePath = `${DISK_SCHEME_PREFIX}${normalized}`
  return slashPath === schemePath ? [slashPath] : [slashPath, schemePath]
}

const fromDiskApiPath = (path: string): string => path.replace(/^disk:\//, '').replace(/^\/+/, '')

const getParentLogicalPath = (logicalPath: string): string => {
  const normalized = fromDiskApiPath(logicalPath).replace(/\/+$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash)
}

const isApplicationsFolder = (logicalPath: string): boolean =>
  fromDiskApiPath(logicalPath) === APPLICATIONS_FOLDER

const parseDiskApiError = (body: string): DiskApiError => {
  try {
    return JSON.parse(body) as DiskApiError
  } catch {
    return {}
  }
}

const readDiskResponseError = async (
  response: Response,
): Promise<{ text: string; parsed: DiskApiError }> => {
  const text = await response.text()
  return { text, parsed: parseDiskApiError(text) }
}

const formatDiskResponseError = (response: Response, body: string): string =>
  `${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`

const isParentNotFound = (status: number, parsed: DiskApiError): boolean =>
  status === 404 || (status === 409 && parsed.error === 'DiskPathDoesntExistsError')

const isFolderAlreadyExists = (status: number, parsed: DiskApiError): boolean =>
  status === 409 &&
  (parsed.error === 'DiskPathPointsToExistentDirectoryError' ||
    parsed.error === 'DiskResourceAlreadyExistsError')

const checkDirectoryExists = async ({
  apiPath,
  headers,
}: {
  apiPath: string
  headers: Record<string, string>
}): Promise<boolean> => {
  const params = new URLSearchParams({ path: apiPath })
  const response = await safeFetch(`${API_BASE_URL}?${params}`, { headers })
  throwIfUnauthorized(response.status, 'Проверка папки на Диске')
  if (!response.ok) return false

  let data: { type?: string }
  try {
    data = (await response.json()) as { type?: string }
  } catch {
    throw new ProcessingError(
      ERR_NETWORK,
      `Некорректный ответ Яндекс.Диска для ${fromDiskApiPath(apiPath)}`,
    )
  }

  if (data.type === 'file') {
    throw new ProcessingError(
      ERR_NETWORK,
      `Конфликт: по пути ${fromDiskApiPath(apiPath)} уже существует файл`,
    )
  }
  return data.type === 'dir'
}

const directoryExistsOnDisk = async ({
  logicalPath,
  headers,
}: {
  logicalPath: string
  headers: Record<string, string>
}): Promise<boolean> => {
  for (const apiPath of getDiskApiPathVariants(logicalPath)) {
    if (await checkDirectoryExists({ apiPath, headers })) return true
  }
  return false
}

const createDirectoryAtPath = async ({
  apiPath,
  headers,
}: {
  apiPath: string
  headers: Record<string, string>
}): Promise<Response> => {
  const params = new URLSearchParams({ path: apiPath })
  return safeFetch(`${API_BASE_URL}?${params}`, { method: 'PUT', headers })
}

const ensureApplicationsFolder = async ({ token }: { token: string }): Promise<void> => {
  const headers = getHeaders(token)

  if (await directoryExistsOnDisk({ logicalPath: APPLICATIONS_FOLDER, headers })) return

  let lastError = ''

  for (const apiPath of getDiskApiPathVariants(APPLICATIONS_FOLDER)) {
    const createResponse = await createDirectoryAtPath({ apiPath, headers })
    if (createResponse.status === 201) return

    throwIfUnauthorized(createResponse.status, 'Создание папки на Диске')

    const { text: errorText, parsed } = await readDiskResponseError(createResponse)
    lastError = formatDiskResponseError(createResponse, errorText)

    if (isFolderAlreadyExists(createResponse.status, parsed)) {
      if (await checkDirectoryExists({ apiPath, headers })) return
    }
  }

  if (await directoryExistsOnDisk({ logicalPath: APPLICATIONS_FOLDER, headers })) return

  throw new ProcessingError(
    ERR_NETWORK,
    `Не удалось создать папку «${APPLICATIONS_FOLDER}»: ${lastError || 'неизвестная ошибка'}`,
  )
}

const createDirectorySegment = async ({
  logicalPath,
  token,
}: {
  logicalPath: string
  token: string
}): Promise<void> => {
  const displayPath = logicalPath
  const apiPath = toDiskApiPath(logicalPath)
  const headers = getHeaders(token)

  if (await directoryExistsOnDisk({ logicalPath, headers })) return

  if (isApplicationsFolder(logicalPath)) {
    await ensureApplicationsFolder({ token })
    return
  }

  const createDirectory = async (): Promise<Response> => createDirectoryAtPath({ apiPath, headers })

  let createResponse = await createDirectory()
  if (createResponse.status === 201) return

  throwIfUnauthorized(createResponse.status, 'Создание папки на Диске')

  let { text: errorText, parsed } = await readDiskResponseError(createResponse)

  if (isFolderAlreadyExists(createResponse.status, parsed)) {
    if (await checkDirectoryExists({ apiPath, headers })) return
  }

  if (isParentNotFound(createResponse.status, parsed)) {
    const parentPath = getParentLogicalPath(logicalPath)
    if (parentPath) {
      await createDirectorySegment({ logicalPath: parentPath, token })
    }

    for (const variantPath of getDiskApiPathVariants(logicalPath)) {
      createResponse = await createDirectoryAtPath({ apiPath: variantPath, headers })
      if (createResponse.status === 201) return
      ;({ text: errorText, parsed } = await readDiskResponseError(createResponse))
      if (isFolderAlreadyExists(createResponse.status, parsed)) {
        if (await checkDirectoryExists({ apiPath: variantPath, headers })) return
      }
      if (!isParentNotFound(createResponse.status, parsed)) break
    }
  }

  if (createResponse.status === 403) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Нет доступа к Яндекс.Диску (${displayPath}). Проверьте права cloud_api:disk.write в OAuth-приложении и войдите заново`,
    )
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `Не удалось создать папку ${displayPath}: ${formatDiskResponseError(createResponse, errorText)}`,
  )
}

const ensureFolderExists = async ({
  path,
  token,
}: {
  path: string
  token: string
}): Promise<void> => {
  const logicalPath = fromDiskApiPath(path).replace(/\/+$/, '')
  if (!logicalPath) return

  const segments = logicalPath.split('/').filter(Boolean)
  let currentPath = ''

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment
    await createDirectorySegment({ logicalPath: currentPath, token })
  }
}

export const resolveFolderPath = ({
  targetDate,
  includeToday = true,
}: {
  targetDate?: string
  includeToday?: boolean
}): string => {
  const basePath = YANDEX_DISK_FOLDER.replace(/\/+$/, '')

  if (targetDate) {
    return `${basePath}/${targetDate}`
  }
  if (includeToday) {
    return `${basePath}/${new Date().toISOString().slice(0, 10)}`
  }
  return basePath
}

export const ensureStorageFolders = async ({ token }: { token: string }): Promise<void> => {
  await ensureFolderExists({ path: resolveFolderPath({ includeToday: false }), token })
  await ensureFolderExists({ path: resolveFolderPath({ includeToday: true }), token })
}

/** Готовит папку загрузки: базовую, сегодняшнюю или указанную дату. */
export const ensureUploadFolder = async ({
  token,
  targetDate,
}: {
  token: string
  targetDate?: string
}): Promise<void> => {
  if (targetDate) {
    await ensureFolderExists({ path: resolveFolderPath({ targetDate }), token })
    return
  }

  await ensureStorageFolders({ token })
}

export const downloadIndexJson = async ({
  token,
  targetDate,
}: {
  token: string
  targetDate?: string
}): Promise<NmapIndex | null> => {
  const folderPath = resolveFolderPath({ targetDate, includeToday: !targetDate })
  const filePath = `${folderPath}/index.json`
  const headers = getHeaders(token)

  const downloadMeta = await safeFetch(
    `${API_BASE_URL}/download?${new URLSearchParams({ path: toDiskApiPath(filePath) })}`,
    { headers },
  )

  if (downloadMeta.status === 404) return null
  if (!downloadMeta.ok) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить index.json: ${downloadMeta.statusText}`,
    )
  }

  const { href } = (await downloadMeta.json()) as { href?: string }
  if (!href) {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось получить ссылку на скачивание index.json')
  }

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
  token,
  targetDate,
}: {
  data: NmapIndex
  token: string
  targetDate?: string
}): Promise<void> => {
  const folderPath = resolveFolderPath({ targetDate, includeToday: !targetDate })
  await ensureFolderExists({ path: folderPath, token })

  const filePath = `${folderPath}/index.json`
  const headers = getHeaders(token)

  const checkRes = await safeFetch(
    `${API_BASE_URL}?${new URLSearchParams({ path: toDiskApiPath(filePath) })}`,
    { headers },
  )
  if (checkRes.ok) {
    const checkData = (await checkRes.json()) as { type?: string }
    if (checkData.type === 'dir') {
      throw new ProcessingError(ERR_NETWORK, `Конфликт: ${filePath} на Диске является папкой`)
    }
  }

  const uploadMeta = await safeFetch(
    `${API_BASE_URL}/upload?${new URLSearchParams({ path: toDiskApiPath(filePath), overwrite: 'true' })}`,
    { headers },
  )
  if (!uploadMeta.ok) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить URL загрузки: ${uploadMeta.statusText}`,
    )
  }

  const { href } = (await uploadMeta.json()) as { href?: string }
  if (!href) {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось получить ссылку на загрузку index.json')
  }

  const jsonData = JSON.stringify(data, null, 2)
  const uploadResponse = await safeFetch(href, {
    method: 'PUT',
    body: new TextEncoder().encode(jsonData),
  })

  if (!uploadResponse.ok) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Ошибка загрузки index.json: ${uploadResponse.statusText}`,
    )
  }
}

export const fetchYandexUser = async ({ token }: { token: string }): Promise<YandexUser> => {
  const response = await safeFetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${token}` },
  })

  if (!response.ok) {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось получить данные пользователя')
  }

  const info = (await response.json()) as Record<string, string>
  return {
    id: String(info.id ?? ''),
    login: info.login ?? '',
    display_name: info.display_name,
    real_name: info.real_name,
    default_avatar_id: info.default_avatar_id,
  }
}

const buildAuthUrl = (): { authUrl: URL; redirectUri: string } => {
  const redirectUri = browser.identity.getRedirectURL()
  const authUrl = new URL('https://oauth.yandex.ru/authorize')
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('client_id', YANDEX_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', YANDEX_DISK_SCOPES)
  return { authUrl, redirectUri }
}

const parseAuthResponseUrl = async (
  responseUrl: string,
): Promise<{ token: string; user: YandexUser }> => {
  const hash = new URL(responseUrl).hash.slice(1)
  const params = new URLSearchParams(hash)
  const oauthError = params.get('error')
  if (oauthError) {
    const description = params.get('error_description') ?? oauthError
    throw new ProcessingError(ERR_NETWORK, `OAuth: ${description}`)
  }

  const token = params.get('access_token')
  if (!token) {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось получить токен авторизации')
  }

  assertDiskWriteScope(params.get('scope') ?? '')
  await verifyDiskAccess({ token })

  const user = await fetchYandexUser({ token })
  return { token, user }
}

/** Запускает OAuth-поток Яндекс ID (silent или с экраном согласия). */
export const launchYandexAuth = async ({
  interactive = true,
}: {
  interactive?: boolean
} = {}): Promise<{ token: string; user: YandexUser }> => {
  const { authUrl, redirectUri } = buildAuthUrl()

  let responseUrl: string | undefined
  try {
    responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ошибка авторизации'
    if (message.includes('did not approve')) {
      throw new ProcessingError(
        ERR_NETWORK,
        interactive
          ? `Авторизация не завершена. Проверьте: 1) Redirect URI в OAuth = ${redirectUri}; 2) в приложении включён cloud_api:disk.write; 3) на экране Яндекса нажмите «Разрешить»`
          : 'Авторизация не завершена',
      )
    }
    throw new ProcessingError(ERR_NETWORK, message)
  }

  if (!responseUrl) {
    throw new ProcessingError(
      ERR_NETWORK,
      interactive ? 'Авторизация отменена' : 'Сессия не найдена',
    )
  }

  return parseAuthResponseUrl(responseUrl)
}

export const STORAGE_TOKEN_KEY = 'yandex_token'
export const STORAGE_USER_KEY = 'yandex_user'

export const getStoredAuth = async (): Promise<{ token: string; user: YandexUser } | null> => {
  const stored = await browser.storage.local.get([STORAGE_TOKEN_KEY, STORAGE_USER_KEY])
  const token = stored[STORAGE_TOKEN_KEY] as string | undefined
  const user = stored[STORAGE_USER_KEY] as YandexUser | undefined
  if (!token || !user) return null
  return { token, user }
}

export const saveAuth = async ({
  token,
  user,
}: {
  token: string
  user: YandexUser
}): Promise<void> => {
  await browser.storage.local.set({
    [STORAGE_TOKEN_KEY]: token,
    [STORAGE_USER_KEY]: user,
  })
}

export const clearAuth = async (): Promise<void> => {
  await browser.storage.local.remove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY])
}

const isStoredAuthValid = async ({ token }: { token: string }): Promise<boolean> => {
  try {
    await verifyDiskAccess({ token })
    return true
  } catch {
    return false
  }
}

/**
 * Восстанавливает сессию: проверяет сохранённый токен, затем silent OAuth.
 * При interactive: true открывает экран согласия, если silent не сработал.
 */
export const ensureYandexAuth = async ({
  interactive = false,
}: {
  interactive?: boolean
} = {}): Promise<{ token: string; user: YandexUser } | null> => {
  const stored = await getStoredAuth()
  if (stored && (await isStoredAuthValid({ token: stored.token }))) {
    return stored
  }

  if (stored) {
    await clearAuth()
  }

  try {
    const auth = await launchYandexAuth({ interactive: false })
    await saveAuth(auth)
    return auth
  } catch {
    // silent OAuth недоступен — первый вход или истёкший consent
  }

  if (!interactive) {
    return null
  }

  const auth = await launchYandexAuth({ interactive: true })
  await saveAuth(auth)
  return auth
}
