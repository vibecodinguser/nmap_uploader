import { browser } from 'wxt/browser'

/** Redirect URI для OAuth: override из .env или URI браузера по ID расширения. */
export const getOAuthRedirectUri = (): string => {
  const override = import.meta.env.YANDEX_REDIRECT_URI?.trim()
  if (override) return override
  return browser.identity.getRedirectURL()
}
