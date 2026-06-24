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
  displayName?: string
  realName?: string
  defaultAvatarId?: string
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
  if (!id) {
    return null
  }
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
    binary += String.fromCodePoint(...chunk)
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
  if (!url) {
    return null
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (bytes.length === 0) {
      return null
    }
    const contentType = response.headers.get('content-type')
    const mimeTypeStr = contentType?.split(';')[0]
    const mime = mimeTypeStr?.trim() || 'image/jpeg'
    return bytesToDataUrl(bytes, mime)
  } catch {
    return null
  }
}

export const loadUserAvatarDataUrl = async (user: YandexUser): Promise<string | null> => {
  const avatarId = user.defaultAvatarId?.trim()
  if (!avatarId) {
    return null
  }
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
      'Токен не принят Яндекс.Диском. ' +
        'Выйдите и войдите заново — нужен новый токен с правом cloud_api:disk.write',
    )
  }

  if (!response.ok) {
    const detail = await response.text()
    let suffix = ''
    if (detail) {
      suffix = ` — ${detail}`
    }
    throw new ProcessingError(
      ERR_NETWORK,
      `Яндекс.Диск недоступен: ${response.statusText}${suffix}`,
    )
  }
}

const assertDiskWriteScope = (scope: string): void => {
  if (scope.includes('cloud_api:disk.write')) {
    return
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `Токен выдан без права записи на Диск (scope: ${scope || 'не указан'}). ` +
      'Выйдите и войдите заново после добавления cloud_api:disk.write в OAuth-приложении',
  )
}

const throwIfUnauthorized = (status: number, context: string): void => {
  if (status !== 401) {
    return
  }

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
    let detail = 'сеть недоступна'
    if (error instanceof Error) {
      detail = error.message
    }
    throw new ProcessingError(ERR_NETWORK, `Запрос к Яндекс.Диску не выполнен: ${detail}`)
  }
}

/** Преобразует логический путь в формат REST API Яндекс.Диска. */
const toDiskApiPath = (logicalPath: string): string => {
  if (!logicalPath) {
    return DISK_ROOT_PREFIX
  }
  if (logicalPath.startsWith('disk:/') || logicalPath.startsWith('app:/')) {
    return logicalPath
  }
  const noLeadingSlash = logicalPath.replace(/^\/+/, '')
  const normalized = noLeadingSlash.replace(/\/+$/, '')
  return `${DISK_ROOT_PREFIX}${normalized}`
}

/** Варианты path для одного логического пути — API принимает и `/`, и `disk:/`. */
const getDiskApiPathVariants = (logicalPath: string): string[] => {
  const fromDiskPath = fromDiskApiPath(logicalPath)
  const normalized = fromDiskPath.replace(/\/+$/, '')
  if (!normalized) {
    const schemePrefix = DISK_SCHEME_PREFIX.slice(0, -1)
    return [DISK_ROOT_PREFIX, schemePrefix]
  }

  const slashPath = `${DISK_ROOT_PREFIX}${normalized}`
  const schemePath = `${DISK_SCHEME_PREFIX}${normalized}`
  if (slashPath === schemePath) {
    return [slashPath]
  }
  return [slashPath, schemePath]
}

const fromDiskApiPath = (path: string): string => {
  const noDiskPrefix = path.replace(/^disk:\//, '')
  return noDiskPrefix.replace(/^\/+/, '')
}

const getParentLogicalPath = (logicalPath: string): string => {
  const fromDiskPath = fromDiskApiPath(logicalPath)
  const normalized = fromDiskPath.replace(/\/+$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash === -1) {
    return ''
  }
  return normalized.slice(0, lastSlash)
}

const isApplicationsFolder = (logicalPath: string): boolean => {
  const diskPath = fromDiskApiPath(logicalPath)
  return diskPath === APPLICATIONS_FOLDER
}

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

const formatDiskResponseError = (response: Response, body: string): string => {
  let suffix = ''
  if (body) {
    suffix = ` — ${body}`
  }
  return `${response.status} ${response.statusText}${suffix}`
}

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
  if (!response.ok) {
    return false
  }

  let data: { type?: string }
  try {
    data = (await response.json()) as { type?: string }
  } catch {
    const diskPath = fromDiskApiPath(apiPath)
    throw new ProcessingError(ERR_NETWORK, `Некорректный ответ Яндекс.Диска для ${diskPath}`)
  }

  if (data.type === 'file') {
    const diskPath = fromDiskApiPath(apiPath)
    throw new ProcessingError(ERR_NETWORK, `Конфликт: по пути ${diskPath} уже существует файл`)
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
    if (await checkDirectoryExists({ apiPath, headers })) {
      return true
    }
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

  if (await directoryExistsOnDisk({ logicalPath: APPLICATIONS_FOLDER, headers })) {
    return
  }

  let lastError = ''

  for (const apiPath of getDiskApiPathVariants(APPLICATIONS_FOLDER)) {
    const createResponse = await createDirectoryAtPath({ apiPath, headers })
    if (createResponse.status === 201) {
      return
    }

    throwIfUnauthorized(createResponse.status, 'Создание папки на Диске')

    const { text: errorText, parsed } = await readDiskResponseError(createResponse)
    lastError = formatDiskResponseError(createResponse, errorText)

    if (isFolderAlreadyExists(createResponse.status, parsed)) {
      if (await checkDirectoryExists({ apiPath, headers })) {
        return
      }
    }
  }

  if (await directoryExistsOnDisk({ logicalPath: APPLICATIONS_FOLDER, headers })) {
    return
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `Не удалось создать папку «${APPLICATIONS_FOLDER}»: ` + `${lastError || 'неизвестная ошибка'}`,
  )
}

const throwIfForbidden = (status: number, path: string): void => {
  if (status !== 403) {
    return
  }
  const message = [
    `Нет доступа к Яндекс.Диску (${path}).`,
    'Проверьте права cloud_api:disk.write в OAuth-приложении и войдите заново',
  ].join(' ')
  throw new ProcessingError(ERR_NETWORK, message)
}

const handleMissingParent = async ({
  logicalPath,
  token,
  headers,
}: {
  logicalPath: string
  token: string
  headers: Record<string, string>
}): Promise<{ success: boolean; response?: Response; errorText?: string }> => {
  const parentPath = getParentLogicalPath(logicalPath)
  if (parentPath) {
    await createDirectorySegment({ logicalPath: parentPath, token })
  }

  let lastResponse: Response | undefined
  let lastErrorText: string | undefined

  const variants = getDiskApiPathVariants(logicalPath)
  for (const variantPath of variants) {
    const createResponse = await createDirectoryAtPath({ apiPath: variantPath, headers })
    if (createResponse.status === 201) {
      return { success: true }
    }

    const { text: errorText, parsed } = await readDiskResponseError(createResponse)

    const existsAlready = isFolderAlreadyExists(createResponse.status, parsed)
    if (existsAlready && (await checkDirectoryExists({ apiPath: variantPath, headers }))) {
      return { success: true }
    }

    lastResponse = createResponse
    lastErrorText = errorText

    if (!isParentNotFound(createResponse.status, parsed)) {
      return { success: false, response: lastResponse, errorText: lastErrorText }
    }
  }

  return { success: false, response: lastResponse, errorText: lastErrorText }
}

const createDirectorySegment = async ({
  logicalPath,
  token,
}: {
  logicalPath: string
  token: string
}): Promise<void> => {
  const headers = getHeaders(token)

  if (await directoryExistsOnDisk({ logicalPath, headers })) {
    return
  }

  if (isApplicationsFolder(logicalPath)) {
    await ensureApplicationsFolder({ token })
    return
  }

  const apiPath = toDiskApiPath(logicalPath)
  let createResponse = await createDirectoryAtPath({ apiPath, headers })
  if (createResponse.status === 201) {
    return
  }

  throwIfUnauthorized(createResponse.status, 'Создание папки на Диске')
  let { text: errorText, parsed } = await readDiskResponseError(createResponse)

  const existsAlready = isFolderAlreadyExists(createResponse.status, parsed)
  if (existsAlready && (await checkDirectoryExists({ apiPath, headers }))) {
    return
  }

  if (isParentNotFound(createResponse.status, parsed)) {
    const parentResult = await handleMissingParent({ logicalPath, token, headers })
    if (parentResult.success) {
      return
    }
    if (parentResult.response) {
      createResponse = parentResult.response
      errorText = parentResult.errorText || ''
    }
  }

  throwIfForbidden(createResponse.status, logicalPath)
  const errorMsg = formatDiskResponseError(createResponse, errorText)
  throw new ProcessingError(ERR_NETWORK, `Не удалось создать папку ${logicalPath}: ${errorMsg}`)
}

const ensureFolderExists = async ({
  path,
  token,
}: {
  path: string
  token: string
}): Promise<void> => {
  const fromDiskPath = fromDiskApiPath(path)
  const logicalPath = fromDiskPath.replace(/\/+$/, '')
  if (logicalPath) {
    const splitSegments = logicalPath.split('/')
    const segments = splitSegments.filter(Boolean)
    let currentPath = ''

    for (const segment of segments) {
      if (currentPath) {
        currentPath = `${currentPath}/${segment}`
      } else {
        currentPath = segment
      }
      await createDirectorySegment({ logicalPath: currentPath, token })
    }
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
    const todayDate = new Date()
    const todayIso = todayDate.toISOString()
    const todayStr = todayIso.slice(0, 10)
    return `${basePath}/${todayStr}`
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

const fetchDiskListOffset = async (
  basePath: string,
  headers: Record<string, string>,
  offset: number,
): Promise<{ newDates: string[]; nextOffset: number; hasMore: boolean }> => {
  const params = new URLSearchParams({
    path: toDiskApiPath(basePath),
    limit: String(DISK_LIST_PAGE_SIZE),
    offset: String(offset),
    fields:
      '_embedded.items.name,_embedded.items.type,_embedded.total,_embedded.offset,_embedded.limit',
  })

  const response = await safeFetch(`${API_BASE_URL}?${params}`, { headers })
  throwIfUnauthorized(response.status, 'Список папок на Диске')

  if (!response.ok) {
    if (response.status === 404) {
      return { newDates: [], nextOffset: offset, hasMore: false }
    }
    const detail = await response.text()
    let suffix = ''
    if (detail) {
      suffix = ` — ${detail}`
    }
    throw new ProcessingError(
      ERR_NETWORK,
      `Не удалось получить список папок: ${response.statusText}${suffix}`,
    )
  }

  let data: DiskListResponse
  try {
    data = (await response.json()) as DiskListResponse
  } catch {
    throw new ProcessingError(ERR_NETWORK, 'Некорректный ответ Яндекс.Диска при чтении папок')
  }

  const items = data._embedded?.items ?? []
  const newDates: string[] = []
  for (const item of items) {
    const name = item.name?.trim()
    if (item.type === 'dir' && name && isDateFolderName(name)) {
      newDates.push(name)
    }
  }

  const total = data._embedded?.total ?? items.length
  const nextOffset = offset + items.length
  const hasMore = items.length > 0 && nextOffset < total

  return { newDates, nextOffset, hasMore }
}

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

  return dates.sort() // NOSONAR
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
  const filePath = `${folderPath}/index.json`
  const headers = getHeaders(token)

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
  token,
  targetDate,
}: {
  data: NmapIndex
  token: string
  targetDate?: string
}): Promise<void> => {
  const folderPath = resolveFolderPath({ targetDate, includeToday: targetDate === undefined })
  await ensureFolderExists({ path: folderPath, token })

  const filePath = `${folderPath}/index.json`
  const headers = getHeaders(token)

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

const resolveDefaultAvatarId = (avatarRaw: unknown): string | undefined => {
  let result: string | undefined
  if (typeof avatarRaw === 'string' && avatarRaw.trim() !== '') {
    result = avatarRaw
  }
  return result
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

  let id = ''
  if (typeof info.id === 'string' || typeof info.id === 'number') {
    id = String(info.id)
  }

  let login = ''
  if (typeof info.login === 'string') {
    login = info.login
  }

  let displayName: string | undefined
  if (typeof info.display_name === 'string') {
    displayName = info.display_name
  }

  let realName: string | undefined
  if (typeof info.real_name === 'string') {
    realName = info.real_name
  }

  return {
    id,
    login,
    displayName,
    realName,
    defaultAvatarId: resolveDefaultAvatarId(avatarRaw),
  }
}

const buildAuthUrl = ({
  forceConfirm = false,
}: {
  forceConfirm?: boolean
} = {}): { authUrl: URL; redirectUri: string; launchUrl: string } => {
  let launchUrl = ''
  const redirectUri = getOAuthRedirectUri()
  const authUrl = new URL('https://oauth.yandex.ru/authorize')
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('client_id', YANDEX_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', YANDEX_DISK_SCOPES)

  if (forceConfirm) {
    authUrl.searchParams.set('force_confirm', 'yes')
    const oauthUrl = authUrl.toString()
    // В Yandex Browser force_confirm часто не показывает выбор аккаунта — обходим через Passport.
    const accountListUrl = new URL('https://passport.yandex.ru/auth/list')
    accountListUrl.searchParams.set('retpath', oauthUrl)
    launchUrl = accountListUrl.toString()
  } else {
    launchUrl = authUrl.toString()
  }

  return { authUrl, redirectUri, launchUrl }
}

const parseAuthResponseUrl = async (
  responseUrl: string,
): Promise<{ token: string; user: YandexUser }> => {
  const urlObj = new URL(responseUrl)
  const hash = urlObj.hash.slice(1)
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

  const scopeStr = params.get('scope') ?? ''
  assertDiskWriteScope(scopeStr)
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
    let message = 'Ошибка авторизации'
    if (error instanceof Error) {
      message = error.message
    }
    if (message.includes('did not approve')) {
      if (!interactive) {
        throw new ProcessingError(ERR_NETWORK, 'Авторизация не завершена')
      }
      let firefoxNote = ''
      if (redirectUri === FIREFOX_OAUTH_REDIRECT_URI) {
        firefoxNote =
          ` (Firefox: SHA1 от ${FIREFOX_EXTENSION_ID}; ` +
          `не nmap-uploader_local.dev и не 127.0.0.1/mozoauth2…)`
      }
      const hint =
        `Авторизация не завершена. Проверьте: 1) Redirect URI в oauth.yandex.ru = ${redirectUri}${firefoxNote}` +
        '; 2) в приложении включён cloud_api:disk.write; 3) на экране Яндекса нажмите «Разрешить»'
      throw new ProcessingError(ERR_NETWORK, hint)
    }
    throw new ProcessingError(ERR_NETWORK, message)
  }

  if (!responseUrl) {
    let reason = 'Сессия не найдена'
    if (interactive) {
      reason = 'Авторизация отменена'
    }
    throw new ProcessingError(ERR_NETWORK, reason)
  }

  return parseAuthResponseUrl(responseUrl)
}

export const STORAGE_TOKEN_KEY = 'yandex_token'
export const STORAGE_USER_KEY = 'yandex_user'
export const STORAGE_EXPLICIT_LOGOUT_KEY = 'yandex_explicit_logout'

export const getStoredAuth = async (): Promise<{ token: string; user: YandexUser } | null> => {
  let result: { token: string; user: YandexUser } | null = null
  const stored = await browser.storage.local.get([STORAGE_TOKEN_KEY, STORAGE_USER_KEY])
  const token = stored[STORAGE_TOKEN_KEY] as string | undefined
  const user = stored[STORAGE_USER_KEY] as YandexUser | undefined
  if (token && user) {
    result = { token, user }
  }
  return result
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
  let isValid = false
  try {
    await verifyDiskAccess({ token })
    isValid = true
  } catch {
    isValid = false
  }
  return isValid
}

/** Обновляет профиль из login.yandex.ru (в т.ч. default_avatar_id после login:avatar). */
export const refreshStoredUserProfile = async ({
  token,
  user,
}: {
  token: string
  user: YandexUser
}): Promise<YandexUser> => {
  let resultUser = user
  try {
    const fresh = await fetchYandexUser({ token })
    await saveAuth({ token, user: fresh })
    resultUser = fresh
  } catch {
    resultUser = user
  }
  return resultUser
}

export type AuthPayload = {
  user: YandexUser | null
  avatarDataUrl: string | null
}

export const buildAuthPayload = async (
  auth: { token: string; user: YandexUser } | null,
): Promise<AuthPayload> => {
  let payload: AuthPayload = { user: null, avatarDataUrl: null }
  if (auth) {
    const user = await refreshStoredUserProfile({ token: auth.token, user: auth.user })
    const avatarDataUrl = await loadUserAvatarDataUrl(user)
    payload = { user, avatarDataUrl }
  }
  return payload
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
    const user = await refreshStoredUserProfile({ token: stored.token, user: stored.user })
    return { token: stored.token, user }
  }

  if (stored) {
    await clearAuth()
  }

  if (interactive) {
    const auth = await launchYandexAuth({ interactive: true, forceConfirm: true })
    await saveAuth(auth)
    return auth
  }

  try {
    const auth = await launchYandexAuth({ interactive: false })
    await saveAuth(auth)
    return auth
  } catch {
    return null
  }
}
