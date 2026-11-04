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

type PermissionsRequest = { origins?: string[]; permissions?: string[] }

type RegisteredContentScript = {
  id: string
  js?: string[]
  matches?: string[]
  runAt?: string
  allFrames?: boolean
  world?: string
}

/** Выданные хосты: `permissions.contains` отвечает по этому набору. */
const grantedOrigins = new Set<string>()
/** Результат следующего `permissions.request`; undefined — выдать доступ. */
let nextPermissionsRequestResult: boolean | undefined
const registeredContentScripts = new Map<string, RegisteredContentScript>()

const permissionsOnAddedListeners: ((permissions: PermissionsRequest) => void)[] = []
const permissionsOnRemovedListeners: ((permissions: PermissionsRequest) => void)[] = []

const isGranted = ({ origins = [] }: PermissionsRequest): boolean =>
  origins.every((origin) => grantedOrigins.has(origin))

const requestPermissions = vi.fn(async (request: PermissionsRequest): Promise<boolean> => {
  if (nextPermissionsRequestResult === false) return false
  for (const origin of request.origins ?? []) {
    grantedOrigins.add(origin)
  }
  for (const listener of permissionsOnAddedListeners) {
    listener({ origins: request.origins })
  }
  return true
})

const removePermissions = vi.fn(async (request: PermissionsRequest): Promise<boolean> => {
  for (const origin of request.origins ?? []) {
    grantedOrigins.delete(origin)
  }
  for (const listener of permissionsOnRemovedListeners) {
    listener({ origins: request.origins })
  }
  return true
})

const containsPermissions = vi.fn(
  async (request: PermissionsRequest): Promise<boolean> => isGranted(request),
)

const getRegisteredContentScripts = vi.fn(
  async (): Promise<RegisteredContentScript[]> => [...registeredContentScripts.values()],
)

const registerContentScripts = vi.fn(async (scripts: RegisteredContentScript[]): Promise<void> => {
  for (const script of scripts) {
    if (registeredContentScripts.has(script.id)) {
      throw new Error(`Content script already registered: ${script.id}`)
    }
    registeredContentScripts.set(script.id, script)
  }
})

const updateContentScripts = vi.fn(async (scripts: RegisteredContentScript[]): Promise<void> => {
  for (const script of scripts) {
    registeredContentScripts.set(script.id, script)
  }
})

const unregisterContentScripts = vi.fn(
  async ({ ids = [] }: { ids?: string[] } = {}): Promise<void> => {
    for (const id of ids) {
      registeredContentScripts.delete(id)
    }
  },
)

function addListenerTo(
  listeners: ((permissions: PermissionsRequest) => void)[],
  listener: (permissions: PermissionsRequest) => void,
): void {
  listeners.push(listener)
}

function removeListenerFrom(
  listeners: ((permissions: PermissionsRequest) => void)[],
  listener: (permissions: PermissionsRequest) => void,
): void {
  const index = listeners.indexOf(listener)
  if (index >= 0) listeners.splice(index, 1)
}

function installBrowserMock(): void {
  fakeBrowser.runtime.id = EXTENSION_ID
  fakeBrowser.runtime.getURL = getURL as (path: string) => string
  fakeBrowser.identity.getRedirectURL = getRedirectURL
  fakeBrowser.i18n.getUILanguage = getUILanguage

  const browserApi = fakeBrowser as unknown as BrowserApi
  browserApi.identity.launchWebAuthFlow =
    launchWebAuthFlow as unknown as BrowserApi['identity']['launchWebAuthFlow']

  const permissions = {
    contains: containsPermissions,
    request: requestPermissions,
    remove: removePermissions,
    onAdded: {
      addListener: (listener: (permissions: PermissionsRequest) => void) =>
        addListenerTo(permissionsOnAddedListeners, listener),
      removeListener: (listener: (permissions: PermissionsRequest) => void) =>
        removeListenerFrom(permissionsOnAddedListeners, listener),
    },
    onRemoved: {
      addListener: (listener: (permissions: PermissionsRequest) => void) =>
        addListenerTo(permissionsOnRemovedListeners, listener),
      removeListener: (listener: (permissions: PermissionsRequest) => void) =>
        removeListenerFrom(permissionsOnRemovedListeners, listener),
    },
  }

  const scripting = {
    getRegisteredContentScripts,
    registerContentScripts,
    updateContentScripts,
    unregisterContentScripts,
  }

  Object.assign(browserApi, { permissions, scripting })

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
  grantedOrigins.clear()
  nextPermissionsRequestResult = undefined
  registeredContentScripts.clear()
  permissionsOnAddedListeners.length = 0
  permissionsOnRemovedListeners.length = 0
  containsPermissions.mockClear()
  requestPermissions.mockClear()
  removePermissions.mockClear()
  getRegisteredContentScripts.mockClear()
  registerContentScripts.mockClear()
  updateContentScripts.mockClear()
  unregisterContentScripts.mockClear()
}

/** Управление выданными разрешениями и зарегистрированными скриптами в тестах. */
export const permissionsMock = {
  grant: (...origins: string[]): void => {
    for (const origin of origins) grantedOrigins.add(origin)
  },
  revoke: (...origins: string[]): void => {
    for (const origin of origins) grantedOrigins.delete(origin)
    for (const listener of permissionsOnRemovedListeners) {
      listener({ origins: [...origins] })
    }
  },
  denyNextRequest: (): void => {
    nextPermissionsRequestResult = false
  },
  contains: containsPermissions,
  request: requestPermissions,
  remove: removePermissions,
}

export const scriptingMock = {
  registered: registeredContentScripts,
  getRegisteredContentScripts,
  registerContentScripts,
  updateContentScripts,
  unregisterContentScripts,
}

export { EXTENSION_ID, getRedirectURL, getURL, launchWebAuthFlow }
