import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { requestEnsureAuth } from '@/lib/yandex/auth_message'
import type { YandexUser } from '@/lib/yandex/client'

type AuthState = {
  user: YandexUser | null
  isLoading: boolean
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
  })

  const refreshUser = useCallback(async () => {
    const response = await browser.runtime.sendMessage({ action: 'getAuth' })
    const user = (response as { user?: YandexUser | null } | undefined)?.user ?? null
    setState({ user, isLoading: false })
    return user
  }, [])

  useEffect(() => {
    requestEnsureAuth({ interactive: false })
      .then((response) => {
        setState({
          user: response.ok ? (response.user ?? null) : null,
          isLoading: false,
        })
      })
      .catch(() => {
        setState((prev) => ({ ...prev, isLoading: false }))
      })
  }, [])

  const handleLogout = useCallback(async () => {
    await browser.runtime.sendMessage({ action: 'logout' })
    setState((prev) => ({ ...prev, user: null }))
  }, [])

  return {
    user: state.user,
    isLoading: state.isLoading,
    isLoggedIn: Boolean(state.user),
    refreshUser,
    handleLogout,
  }
}
