import { browser } from 'wxt/browser'
import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { FIREFOX_EXTENSION_ID } from '@/lib/firefox_extension_id'
import type { NmapIndex } from '@/lib/nmap_index'
import { isValidTargetDate } from '@/lib/point_uploader'
import { assertAllowedDiskHref } from '@/lib/yandex/disk_url'
import { FIREFOX_OAUTH_REDIRECT_URI, getOAuthRedirectUri } from '@/lib/yandex/oauth_redirect'

export const YANDEX_CLIENT_ID = 'ef45c7e176e844c087bc2487985ad275'
export const YANDEX_DISK_FOLDER = 'Приложения/Блокнот картографа Народной карты'
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

export type YandexAvatarSize =
  | 'islands-small'
  | 'islands-34'
  | 'islands-50'
  | 'islands-retina-50'
  | 'islands-75'

export const getYandexAvatarUrl = ({
  avatarId,
  size = 'islands-small',
}: {
  avatarId?: string
  size?: YandexAvatarSize
}): string | null => {
  const id = avatarId?.trim()
  if (!id) return null
  if (id.startsWith('https://avatars.yandex.net/')) {
    return id.replace(/\/islands-[\w-]+$/, `/${size}`)
  }
  return `https://avatars.yandex.net/get-yapic/${id}/${size}`
}

const bytesToDataUrl = (bytes: Uint8Array, mime: string): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return `data:${mime};base64,${btoa(binary)}`
}

/** Загружает портрет в background (обход CSP n.maps для shadow DOM). */
export const fetchYandexAvatarDataUrl = async ({
  avatarId,
  size = 'islands-small',
}: {
  avatarId: string
  size?: YandexAvatarSize
}): Promise<string | null> => {
  const url = getYandexAvatarUrl({ avatarId, size })
  if (!url) return null

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length === 0) return null
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    return bytesToDataUrl(bytes, mime)
  } catch {
    return null
  }
}

export const loadUserAvatarDataUrl = async (user: YandexUser): Promise<string | null> => {
  const avatarId = user.default_avatar_id?.trim()
  if (!avatarId) return null
  return fetchYandexAvatarDataUrl({ avatarId, size: 'islands-retina-50' })
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

const DATE_FOLDER_NAME_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DISK_LIST_PAGE_SIZE = 100

type DiskListItem = {
  name?: string
  type?: string
}

type DiskListResponse = {
  _embedded?: {
    items?: DiskListItem[]
    total?: number
    offset?: number
    limit?: number
  }
}

const isDateFolderName = (name: string): boolean =>
  DATE_FOLDER_NAME_PATTERN.test(name) && isValidTargetDate(name)

/** Возвращает даты (YYYY-MM-DD), для которых на Диске уже есть папка загрузки. */
export const listExistingDateFolders = async ({ token }: { token: string }): Promise<string[]> => {
  const basePath = resolveFolderPath({ includeToday: false })
  const headers = getHeaders(token)
  const dates: string[] = []
  let offset = 0

  while (true) {
    const params = new URLSearchParams({
      path: toDiskApiPath(basePath),
      limit: String(DISK_LIST_PAGE_SIZE),
      offset: String(offset),
      fields:
        '_embedded.items.name,_embedded.items.type,_embedded.total,_embedded.offset,_embedded.limit',
    })

    const response = await safeFetch(`${API_BASE_URL}?${params}`, { headers })
    throwIfUnauthorized(response.status, 'Список папок на Диске')

    if (response.status === 404) {
      return dates
    }

    if (!response.ok) {
      const detail = await response.text()
      throw new ProcessingError(
        ERR_NETWORK,
        `Не удалось получить список папок: ${response.statusText}${detail ? ` — ${detail}` : ''}`,
      )
    }

    let data: DiskListResponse
    try {
      data = (await response.json()) as DiskListResponse
    } catch {
      throw new ProcessingError(ERR_NETWORK, 'Некорректный ответ Яндекс.Диска при чтении папок')
    }

    const items = data._embedded?.items ?? []
    for (const item of items) {
      const name = item.name?.trim()
      if (item.type === 'dir' && name && isDateFolderName(name)) {
        dates.push(name)
      }
    }

    const total = data._embedded?.total ?? items.length
    offset += items.length
    if (items.length === 0 || offset >= total) {
      break
    }
  }

  return dates.sort()
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

  assertAllowedDiskHref(href)
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

  const info = (await response.json()) as Record<string, unknown>
  const avatarRaw = info.default_avatar_id
  return {
    id: String(info.id ?? ''),
    login: String(info.login ?? ''),
    display_name: info.display_name != null ? String(info.display_name) : undefined,
    real_name: info.real_name != null ? String(info.real_name) : undefined,
    default_avatar_id:
      avatarRaw != null && String(avatarRaw).trim() !== '' ? String(avatarRaw) : undefined,
  }
}

const buildAuthUrl = ({
  forceConfirm = false,
}: {
  forceConfirm?: boolean
} = {}): { authUrl: URL; redirectUri: string; launchUrl: string } => {
  const redirectUri = getOAuthRedirectUri()
  const authUrl = new URL('https://oauth.yandex.ru/authorize')
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('client_id', YANDEX_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', YANDEX_DISK_SCOPES)
  if (forceConfirm) {
    authUrl.searchParams.set('force_confirm', 'yes')
  }

  const oauthUrl = authUrl.toString()
  if (!forceConfirm) {
    return { authUrl, redirectUri, launchUrl: oauthUrl }
  }

  // В Yandex Browser force_confirm часто не показывает выбор аккаунта — обходим через Passport.
  const accountListUrl = new URL('https://passport.yandex.ru/auth/list')
  accountListUrl.searchParams.set('retpath', oauthUrl)
  return { authUrl, redirectUri, launchUrl: accountListUrl.toString() }
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
  forceConfirm = false,
}: {
  interactive?: boolean
  forceConfirm?: boolean
} = {}): Promise<{ token: string; user: YandexUser }> => {
  const { redirectUri, launchUrl } = buildAuthUrl({ forceConfirm })

  let responseUrl: string | undefined
  try {
    responseUrl = await browser.identity.launchWebAuthFlow({
      url: launchUrl,
      interactive,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ошибка авторизации'
    if (message.includes('did not approve')) {
      throw new ProcessingError(
        ERR_NETWORK,
        interactive
          ? `Авторизация не завершена. Проверьте: 1) Redirect URI в oauth.yandex.ru = ${redirectUri}` +
              (redirectUri === FIREFOX_OAUTH_REDIRECT_URI
                ? ` (Firefox: SHA1 от ${FIREFOX_EXTENSION_ID}; не nmap-uploader_local.dev и не 127.0.0.1/mozoauth2…)`
                : '') +
              '; 2) в приложении включён cloud_api:disk.write; 3) на экране Яндекса нажмите «Разрешить»'
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
export const STORAGE_EXPLICIT_LOGOUT_KEY = 'yandex_explicit_logout'

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
  await browser.storage.local.remove(STORAGE_EXPLICIT_LOGOUT_KEY)
}

export const clearAuth = async ({
  explicit = false,
}: {
  explicit?: boolean
} = {}): Promise<void> => {
  await browser.storage.local.remove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY])
  if (explicit) {
    await browser.storage.local.set({ [STORAGE_EXPLICIT_LOGOUT_KEY]: true })
  }
}

const isExplicitLogout = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(STORAGE_EXPLICIT_LOGOUT_KEY)
  return Boolean(stored[STORAGE_EXPLICIT_LOGOUT_KEY])
}

const isStoredAuthValid = async ({ token }: { token: string }): Promise<boolean> => {
  try {
    await verifyDiskAccess({ token })
    return true
  } catch {
    return false
  }
}

/** Обновляет профиль из login.yandex.ru (в т.ч. default_avatar_id после login:avatar). */
export const refreshStoredUserProfile = async ({
  token,
  user,
}: {
  token: string
  user: YandexUser
}): Promise<YandexUser> => {
  try {
    const fresh = await fetchYandexUser({ token })
    await saveAuth({ token, user: fresh })
    return fresh
  } catch {
    return user
  }
}

export type AuthPayload = {
  user: YandexUser | null
  avatarDataUrl: string | null
}

export const buildAuthPayload = async (
  auth: { token: string; user: YandexUser } | null,
): Promise<AuthPayload> => {
  if (!auth) {
    return { user: null, avatarDataUrl: null }
  }

  const user = await refreshStoredUserProfile({ token: auth.token, user: auth.user })
  const avatarDataUrl = await loadUserAvatarDataUrl(user)
  return { user, avatarDataUrl }
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
  if (!interactive && (await isExplicitLogout())) {
    return null
  }

  const stored = await getStoredAuth()
  if (stored && (await isStoredAuthValid({ token: stored.token }))) {
    const user = await refreshStoredUserProfile({
      token: stored.token,
      user: stored.user,
    })
    return { token: stored.token, user }
  }

  if (stored) {
    await clearAuth()
  }

  if (!interactive) {
    try {
      const auth = await launchYandexAuth({ interactive: false })
      await saveAuth(auth)
      return auth
    } catch {}
    return null
  }

  const auth = await launchYandexAuth({ interactive: true, forceConfirm: true })
  await saveAuth(auth)
  return auth
}
