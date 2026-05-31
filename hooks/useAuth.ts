import { useCallback, useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { requestEnsureAuth } from '@/lib/yandex/auth_message'
import type { YandexUser } from '@/lib/yandex/client'

type AuthState = {
  user: YandexUser | null
  avatarDataUrl: string | null
  isLoggingIn: boolean
}

type AuthMessageResponse = {
  user?: YandexUser | null
  avatarDataUrl?: string | null
  ok?: boolean
  error?: string
}

const applyAuthResponse = (
  response: AuthMessageResponse | undefined,
): Pick<AuthState, 'user' | 'avatarDataUrl'> => ({
  user: response?.user ?? null,
  avatarDataUrl: response?.avatarDataUrl ?? null,
})

export const useAuth = () => {
  const sessionEpochRef = useRef(0)
  const [state, setState] = useState<AuthState>({
    user: null,
    avatarDataUrl: null,
    isLoggingIn: false,
  })

  const refreshUser = useCallback(async () => {
    const response = (await browser.runtime.sendMessage({ action: 'getAuth' })) as
      | AuthMessageResponse
      | undefined
    const next = applyAuthResponse(response)
    setState((prev) => ({ ...prev, ...next }))
    return next.user
  }, [])

  useEffect(() => {
    const epoch = sessionEpochRef.current

    requestEnsureAuth({ interactive: false })
      .then((response) => {
        if (sessionEpochRef.current !== epoch) return
        setState((prev) => ({
          ...prev,
          ...applyAuthResponse(response),
        }))
      })
      .catch(() => {
        if (sessionEpochRef.current !== epoch) return
      })
  }, [])

  const handleLogin = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoggingIn: true }))
    try {
      const response = (await browser.runtime.sendMessage({ action: 'login' })) as
        | AuthMessageResponse
        | undefined
      if (!response?.ok) return
      setState((prev) => ({
        ...prev,
        ...applyAuthResponse(response),
      }))
    } catch {
      // OAuth отменён или background недоступен
    } finally {
      setState((prev) => ({ ...prev, isLoggingIn: false }))
    }
  }, [])

  const handleLogout = useCallback(async () => {
    sessionEpochRef.current += 1
    await browser.runtime.sendMessage({ action: 'logout' })
    setState({
      user: null,
      avatarDataUrl: null,
      isLoggingIn: false,
    })
  }, [])

  return {
    user: state.user,
    avatarDataUrl: state.avatarDataUrl,
    isLoggingIn: state.isLoggingIn,
    isLoggedIn: Boolean(state.user),
    refreshUser,
    handleLogin,
    handleLogout,
  }
}
