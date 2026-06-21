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

const mergeAuthState = (
  prev: AuthState,
  next: Pick<AuthState, 'user' | 'avatarDataUrl'>,
): AuthState => ({
  ...prev,
  ...next,
})

const withLoggingIn = (prev: AuthState, isLoggingIn: boolean): AuthState => ({
  ...prev,
  isLoggingIn,
})

const handleAuthTaskSuccess = (
  task: Promise<AuthMessageResponse>,
  onSuccess: (response: AuthMessageResponse) => void,
): void => {
  task.then(onSuccess)
}

const handleAuthTaskError = (task: Promise<AuthMessageResponse>, onError: () => void): void => {
  task.catch(onError)
}

export const useAuth = () => {
  const sessionEpochRef = useRef(0)
  const [state, setState] = useState<AuthState>({
    user: null,
    avatarDataUrl: null,
    isLoggingIn: false,
  })

  const refreshUser = useCallback(async function refreshUser() {
    const response = (await browser.runtime.sendMessage({ action: 'getAuth' })) as
      | AuthMessageResponse
      | undefined
    const next = applyAuthResponse(response)
    const updateFromRefresh = (prev: AuthState): AuthState => mergeAuthState(prev, next)
    setState(updateFromRefresh)
    return next.user
  }, [])

  useEffect(function authEffect() {
    const epoch = sessionEpochRef.current

    const onEnsureAuthSuccess = (response: AuthMessageResponse): void => {
      if (sessionEpochRef.current === epoch) {
        const next = applyAuthResponse(response)
        const updateFromEnsureAuth = (prev: AuthState): AuthState => mergeAuthState(prev, next)
        setState(updateFromEnsureAuth)
      }
    }

    const onEnsureAuthError = (): void => {
      // Ошибка ensureAuth при старте не блокирует UI — остаёмся в гостевом режиме.
    }

    const ensureAuthTask = requestEnsureAuth({ interactive: false })
    handleAuthTaskSuccess(ensureAuthTask, onEnsureAuthSuccess)
    handleAuthTaskError(ensureAuthTask, onEnsureAuthError)
  }, [])

  const handleLogin = useCallback(async function handleLogin() {
    const startLogin = (prev: AuthState): AuthState => withLoggingIn(prev, true)
    setState(startLogin)

    try {
      const response = (await browser.runtime.sendMessage({ action: 'login' })) as
        | AuthMessageResponse
        | undefined
      if (response?.ok) {
        const next = applyAuthResponse(response)
        const updateFromLogin = (prev: AuthState): AuthState => mergeAuthState(prev, next)
        setState(updateFromLogin)
      }
    } catch {
      // OAuth отменён или background недоступен
    } finally {
      const finishLogin = (prev: AuthState): AuthState => withLoggingIn(prev, false)
      setState(finishLogin)
    }
  }, [])

  const handleLogout = useCallback(async function handleLogout() {
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
