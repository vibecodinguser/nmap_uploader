import { browser } from 'wxt/browser'

/**
 * Redirect URI Firefox для oauth.yandex.ru: SHA1(gecko.id из lib/firefox_extension_id) + extensions.allizom.org.
 * launchWebAuthFlow перехватывает его без реального HTTP-запроса (в отличие от 127.0.0.1/mozoauth2).
 * @see https://searchfox.org/mozilla-central/source/toolkit/components/extensions/child/ext-identity.js
 */
export const FIREFOX_OAUTH_REDIRECT_URI =
  'https://4a5e412e7f9b878927b1bedbfad1a6905cb32415.extensions.allizom.org/'

const normalizeRedirectUri = (uri: string): string => uri.replace(/\/?$/, '/')

/** Redirect URI для OAuth — всегда browser.identity.getRedirectURL(). */
export const getOAuthRedirectUri = (): string => {
  const browserRedirect = browser.identity.getRedirectURL()
  const override = import.meta.env.YANDEX_REDIRECT_URI?.trim()

  if (override && normalizeRedirectUri(override) !== normalizeRedirectUri(browserRedirect)) {
    console.warn(
      `[nmap_uploader] YANDEX_REDIRECT_URI (${override}) не совпадает с browser.identity.getRedirectURL() (${browserRedirect}). ` +
        `Зарегистрируйте в oauth.yandex.ru: ${browserRedirect}`,
    )
  }

  return browserRedirect
}
