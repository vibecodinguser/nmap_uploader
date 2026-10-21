import { browser } from 'wxt/browser'
import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { FIREFOX_EXTENSION_ID } from '@/lib/firefox_extension_id'
import { loadUserAvatarDataUrl } from './avatar'
import {
  type AuthPayload,
  YANDEX_CLIENT_ID,
  YANDEX_DISK_SCOPES,
  type YandexUser,
} from './constants'
import { FIREFOX_OAUTH_REDIRECT_URI, getOAuthRedirectUri } from './oauth_redirect'
import { clearAuth, getStoredAuth, isExplicitLogout, saveAuth } from './storage'

export const getHeaders = (token: string): Record<string, string> => ({
  Authorization: `OAuth ${token.trim()}`,
  'Content-Type': 'application/json',
})

export const safeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
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

export const assertDiskWriteScope = (scope: string): void => {
  if (scope.includes('cloud_api:disk.write')) {
    return
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `Токен выдан без права записи на Диск (scope: ${scope || 'не указан'}). ` +
      'Выйдите и войдите заново после добавления cloud_api:disk.write в OAuth-приложении',
  )
}

export const throwIfUnauthorized = (status: number, context: string): void => {
  if (status !== 401) {
    return
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `${context}: сессия недействительна. Выйдите и войдите через Яндекс ID заново`,
  )
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

export const buildAuthUrl = ({
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
    const accountListUrl = new URL('https://passport.yandex.ru/auth/list')
    accountListUrl.searchParams.set('retpath', oauthUrl)
    launchUrl = accountListUrl.toString()
  } else {
    launchUrl = authUrl.toString()
  }

  return { authUrl, redirectUri, launchUrl }
}

export const parseAuthResponseUrl = async (
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

export const isStoredAuthValid = async ({ token }: { token: string }): Promise<boolean> => {
  let isValid = false
  try {
    await verifyDiskAccess({ token })
    isValid = true
  } catch {
    isValid = false
  }
  return isValid
}

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
