import { fakeBrowser } from '@webext-core/fake-browser'
import { vi } from 'vitest'
import type { browser } from 'wxt/browser'

type BrowserApi = typeof browser

export const REDIRECT_URI = 'https://extension-id.chromiumapp.org/'

export const buildOAuthRedirectUrl = ({
  accessToken = 'test-token',
  scope = 'login:avatar cloud_api:disk.read cloud_api:disk.write',
  error,
  errorDescription,
}: {
  accessToken?: string
  scope?: string
  error?: string
  errorDescription?: string
} = {}) => {
  if (error) {
    const params = new URLSearchParams({ error, error_description: errorDescription ?? error })
    return `${REDIRECT_URI}#${params.toString()}`
  }

  const params = new URLSearchParams({
    access_token: accessToken,
    scope,
    token_type: 'bearer',
  })
  return `${REDIRECT_URI}#${params.toString()}`
}

const EXTENSION_ID = 'test-extension-id'
const getRedirectURL = vi.fn(() => REDIRECT_URI)
const launchWebAuthFlow = vi.fn(async () => buildOAuthRedirectUrl())
const getURL = vi.fn((path: string) => {
  const normalized = path.replace(/^\//, '')
  return `chrome-extension://${EXTENSION_ID}/${normalized}`
})

fakeBrowser.runtime.id = EXTENSION_ID
fakeBrowser.runtime.getURL = getURL as (path: string) => string
fakeBrowser.identity.getRedirectURL = getRedirectURL
;(fakeBrowser as unknown as BrowserApi).identity.launchWebAuthFlow =
  launchWebAuthFlow as unknown as BrowserApi['identity']['launchWebAuthFlow']

;(globalThis as typeof globalThis & { browser: BrowserApi }).browser =
  fakeBrowser as unknown as BrowserApi

export const resetBrowserMocks = async () => {
  await fakeBrowser.storage.local.clear()
  getRedirectURL.mockReset()
  getRedirectURL.mockReturnValue(REDIRECT_URI)
  getURL.mockReset()
  getURL.mockImplementation((path: string) => {
    const normalized = path.replace(/^\//, '')
    return `chrome-extension://${EXTENSION_ID}/${normalized}`
  })
  launchWebAuthFlow.mockReset()
  launchWebAuthFlow.mockImplementation(async () => buildOAuthRedirectUrl())
}

export { EXTENSION_ID, getRedirectURL, getURL, launchWebAuthFlow }
