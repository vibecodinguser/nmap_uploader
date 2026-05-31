import { describe, expect, it, vi } from 'vitest'
import { requireAuthBeforeAction } from '@/lib/require_auth'

describe('requireAuthBeforeAction', () => {
  it('разрешает действие для авторизованного пользователя', () => {
    const onRequireAuth = vi.fn()

    const isAllowed = requireAuthBeforeAction({
      isLoggedIn: true,
      onRequireAuth,
    })

    expect(isAllowed).toBe(true)
    expect(onRequireAuth).not.toHaveBeenCalled()
  })

  it('блокирует действие и вызывает onRequireAuth без сессии', () => {
    const onRequireAuth = vi.fn()

    const isAllowed = requireAuthBeforeAction({
      isLoggedIn: false,
      onRequireAuth,
    })

    expect(isAllowed).toBe(false)
    expect(onRequireAuth).toHaveBeenCalledOnce()
  })
})
