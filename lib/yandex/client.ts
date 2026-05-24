import { ERR_NETWORK, ProcessingError } from '../errors'
import type { NmapIndex } from '../nmap_index'

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
  const response = await fetch('https://cloud-api.yandex.net/v1/disk/?fields=total_space', {
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

const getParentPath = (path: string): string => {
  const normalized = path.replace(/\/+$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash)
}

const ensureFolderExists = async ({
  path,
  token,
}: {
  path: string
  token: string
}): Promise<void> => {
  if (!path || path === '/') return

  const headers = getHeaders(token)
  const params = new URLSearchParams({ path })

  const checkResponse = await fetch(`${API_BASE_URL}?${params}`, { headers })
  throwIfUnauthorized(checkResponse.status, 'Проверка папки на Диске')
  if (checkResponse.ok) {
    const data = (await checkResponse.json()) as { type?: string }
    if (data.type === 'dir') return
    throw new ProcessingError(ERR_NETWORK, `Конфликт: по пути ${path} уже существует файл`)
  }

  const createResponse = await fetch(`${API_BASE_URL}?${params}`, {
    method: 'PUT',
    headers,
  })

  if (createResponse.status === 201) return

  throwIfUnauthorized(createResponse.status, 'Создание папки на Диске')

  if (createResponse.status === 409) {
    const retryCheck = await fetch(`${API_BASE_URL}?${params}`, { headers })
    if (retryCheck.ok) {
      const data = (await retryCheck.json()) as { type?: string }
      if (data.type === 'dir') return
    }
    throw new ProcessingError(ERR_NETWORK, `Не удалось создать папку ${path}`)
  }

  if (createResponse.status === 404) {
    await ensureFolderExists({ path: getParentPath(path), token })
    const retryResponse = await fetch(`${API_BASE_URL}?${params}`, {
      method: 'PUT',
      headers,
    })
    if (retryResponse.status === 201 || retryResponse.status === 409) return
    throw new ProcessingError(ERR_NETWORK, `Не удалось создать папку ${path}`)
  }

  const errorDetail = await createResponse.text()
  if (createResponse.status === 403) {
    throw new ProcessingError(
      ERR_NETWORK,
      `Нет доступа к Яндекс.Диску (${path}). Проверьте права cloud_api:disk.write в OAuth-приложении и войдите заново`,
    )
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `Не удалось создать папку ${path}: ${createResponse.statusText}${errorDetail ? ` — ${errorDetail}` : ''}`,
  )
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

  const downloadMeta = await fetch(
    `${API_BASE_URL}/download?${new URLSearchParams({ path: filePath })}`,
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

  const fileResponse = await fetch(href)
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

  const checkRes = await fetch(`${API_BASE_URL}?${new URLSearchParams({ path: filePath })}`, {
    headers,
  })
  if (checkRes.ok) {
    const checkData = (await checkRes.json()) as { type?: string }
    if (checkData.type === 'dir') {
      throw new ProcessingError(ERR_NETWORK, `Конфликт: ${filePath} на Диске является папкой`)
    }
  }

  const uploadMeta = await fetch(
    `${API_BASE_URL}/upload?${new URLSearchParams({ path: filePath, overwrite: 'true' })}`,
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
  const uploadResponse = await fetch(href, {
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
  const response = await fetch('https://login.yandex.ru/info?format=json', {
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
