import { fakeBrowser } from '@webext-core/fake-browser'
import { vi } from 'vitest'
import type { browser } from 'wxt/browser'

type BrowserApi = typeof browser

const URI_SCHEME = 'https'
const URI_AUTHORITY = 'extension-id.chromiumapp.org'
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
export const REDIRECT_URI = URI_SCHEME + '://' + URI_AUTHORITY + '/'

const SCOPE_SEPARATOR = ':'

function oauthScope(left: string, right: string): string {
  return left + SCOPE_SEPARATOR + right
}

const DEFAULT_OAUTH_SCOPE = [
  oauthScope('login', 'avatar'),
  oauthScope('cloud_api', 'disk.read'),
  oauthScope('cloud_api', 'disk.write'),
].join(' ')

export type OAuthRedirectUrlOptions = {
  accessToken?: string
  scope?: string
  error?: string
  errorDescription?: string
}

function valueOrDefault(value: string | undefined, defaultValue: string): string {
  let result = defaultValue
  if (value !== undefined) {
    result = value
  }
  return result
}

function buildOAuthHash(options: OAuthRedirectUrlOptions): string {
  const accessToken = valueOrDefault(options.accessToken, 'test-token')
  const scope = valueOrDefault(options.scope, DEFAULT_OAUTH_SCOPE)
  const error = options.error
  const errorDescription = options.errorDescription

  const params = new URLSearchParams()
  if (error) {
    params.set('error', error)
    let description = error
    if (errorDescription !== undefined) {
      description = errorDescription
    }
    params.set('error_description', description)
  } else {
    params.set('access_token', accessToken)
    params.set('scope', scope)
    params.set('token_type', 'bearer')
  }

  return params.toString()
}

export function buildOAuthRedirectUrl(options: OAuthRedirectUrlOptions = {}): string {
  return `${REDIRECT_URI}#${buildOAuthHash(options)}`
}

async function resolveDefaultOAuthRedirectUrl(): Promise<string> {
  return buildOAuthRedirectUrl()
}

const EXTENSION_ID = 'test-extension-id'

function returnRedirectUri(): string {
  return REDIRECT_URI
}

function returnRuUILanguage(): string {
  return 'ru-RU'
}

function buildExtensionUrl(path: string): string {
  const normalized = path.replace(/^\//, '')
  const scheme = 'chrome-extension'
  // biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
  return scheme + '://' + EXTENSION_ID + '/' + normalized
}

const getRedirectURL = vi.fn(returnRedirectUri)
const launchWebAuthFlow = vi.fn(resolveDefaultOAuthRedirectUrl)
const getUILanguage = vi.fn(returnRuUILanguage)
const getURL = vi.fn(buildExtensionUrl)

function installBrowserMock(): void {
  fakeBrowser.runtime.id = EXTENSION_ID
  fakeBrowser.runtime.getURL = getURL as (path: string) => string
  fakeBrowser.identity.getRedirectURL = getRedirectURL
  fakeBrowser.i18n.getUILanguage = getUILanguage

  const browserApi = fakeBrowser as unknown as BrowserApi
  browserApi.identity.launchWebAuthFlow =
    launchWebAuthFlow as unknown as BrowserApi['identity']['launchWebAuthFlow']

  const globalScope = globalThis as typeof globalThis & { browser: BrowserApi }
  globalScope.browser = fakeBrowser as unknown as BrowserApi
}

installBrowserMock()

export async function resetBrowserMocks(): Promise<void> {
  await fakeBrowser.storage.local.clear()
  getRedirectURL.mockReset()
  getRedirectURL.mockReturnValue(REDIRECT_URI)
  getURL.mockReset()
  getURL.mockImplementation(buildExtensionUrl)
  launchWebAuthFlow.mockReset()
  launchWebAuthFlow.mockImplementation(resolveDefaultOAuthRedirectUrl)
  getUILanguage.mockReset()
  getUILanguage.mockReturnValue('ru-RU')
}

export { EXTENSION_ID, getRedirectURL, getURL, launchWebAuthFlow }
