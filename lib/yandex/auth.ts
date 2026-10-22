import { fetchYandexUser, verifyDiskAccess } from './auth_client'
import { launchYandexAuth } from './auth_flow'
import { loadUserAvatarDataUrl } from './avatar'
import type { AuthPayload, YandexUser } from './constants'
import { clearAuth, getStoredAuth, isExplicitLogout, saveAuth } from './storage'

export * from './auth_client'
export * from './auth_flow'

export const isStoredAuthValid = async ({ token }: { token: string }): Promise<boolean> => {
  try {
    await verifyDiskAccess({ token })
    return true
  } catch {
    return false
  }
}

export const refreshStoredUserProfile = async ({
  token,
  user,
}: {
  token: string
  user: YandexUser
}): Promise<YandexUser> => {
  try {
    const fresh = await fetchYandexUser({ token })
    await saveAuth({ token, user: fresh })
    return fresh
  } catch {
    return user
  }
}

export const buildAuthPayload = async (
  auth: { token: string; user: YandexUser } | null,
): Promise<AuthPayload> => {
  if (auth) {
    const user = await refreshStoredUserProfile({ token: auth.token, user: auth.user })
    const avatarDataUrl = await loadUserAvatarDataUrl(user)
    return { user, avatarDataUrl }
  }
  return { user: null, avatarDataUrl: null }
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
