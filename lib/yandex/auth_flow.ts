import { browser } from 'wxt/browser'
import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { FIREFOX_EXTENSION_ID } from '@/lib/firefox_extension_id'
import { assertDiskWriteScope, fetchYandexUser, verifyDiskAccess } from './auth_client'
import { YANDEX_CLIENT_ID, YANDEX_DISK_SCOPES, type YandexUser } from './constants'
import { FIREFOX_OAUTH_REDIRECT_URI, getOAuthRedirectUri } from './oauth_redirect'

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
          'не nmap-uploader_local.dev и не 127.0.0.1/mozoauth2…)'
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
