import { browser } from 'wxt/browser'
import {
  STORAGE_EXPLICIT_LOGOUT_KEY,
  STORAGE_TOKEN_KEY,
  STORAGE_USER_KEY,
  type YandexUser,
} from './constants'

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

export const isExplicitLogout = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(STORAGE_EXPLICIT_LOGOUT_KEY)
  return Boolean(stored[STORAGE_EXPLICIT_LOGOUT_KEY])
}
