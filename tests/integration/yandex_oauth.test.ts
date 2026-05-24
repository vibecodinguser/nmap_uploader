import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAuth,
  ensureYandexAuth,
  getStoredAuth,
  launchYandexAuth,
  saveAuth,
} from '@/lib/yandex/client'
import { buildOAuthRedirectUrl, launchWebAuthFlow } from '@/tests/setup/browser_mock'

describe('OAuth', () => {
  beforeEach(async () => {
    await clearAuth()
  })

  it('launchYandexAuth: парсит токен, проверяет scope и возвращает пользователя', async () => {
    const auth = await launchYandexAuth({ interactive: true })

    expect(auth.token).toBe('test-token')
    expect(auth.user.login).toBe('testuser')
    expect(launchWebAuthFlow).toHaveBeenCalledOnce()

    const call = launchWebAuthFlow.mock.calls[0] as unknown as [{ url?: string }]
    expect(call).toBeDefined()
    const authUrl = new URL(call?.[0]?.url ?? '')
    expect(authUrl.origin).toBe('https://oauth.yandex.ru')
    expect(authUrl.searchParams.get('response_type')).toBe('token')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://extension-id.chromiumapp.org/')
    expect(authUrl.searchParams.get('scope')).toContain('cloud_api:disk.write')
  })

  it('ensureYandexAuth: возвращает сохранённую сессию без launchWebAuthFlow', async () => {
    await saveAuth({
      token: 'stored-token',
      user: { id: '1', login: 'cached' },
    })

    const auth = await ensureYandexAuth({ interactive: false })

    expect(auth?.token).toBe('stored-token')
    expect(auth?.user.login).toBe('cached')
    expect(launchWebAuthFlow).not.toHaveBeenCalled()
  })

  it('ensureYandexAuth: при просроченном токене запускает silent OAuth', async () => {
    await saveAuth({
      token: 'expired-token',
      user: { id: '1', login: 'old' },
    })

    const auth = await ensureYandexAuth({ interactive: false })

    expect(auth?.token).toBe('test-token')
    expect(launchWebAuthFlow).toHaveBeenCalledOnce()
    expect(await getStoredAuth()).toMatchObject({ token: 'test-token' })
  })

  it('ensureYandexAuth: без interactive возвращает null, если silent OAuth недоступен', async () => {
    launchWebAuthFlow.mockRejectedValueOnce(new Error('did not approve access'))

    const auth = await ensureYandexAuth({ interactive: false })

    expect(auth).toBeNull()
  })

  it('ensureYandexAuth: с interactive открывает OAuth после неудачного silent', async () => {
    launchWebAuthFlow
      .mockRejectedValueOnce(new Error('did not approve access'))
      .mockResolvedValueOnce(buildOAuthRedirectUrl())

    const auth = await ensureYandexAuth({ interactive: true })

    expect(auth?.token).toBe('test-token')
    expect(launchWebAuthFlow).toHaveBeenCalledTimes(2)
  })

  it('launchYandexAuth: пробрасывает OAuth-ошибку из hash', async () => {
    launchWebAuthFlow.mockResolvedValueOnce(
      buildOAuthRedirectUrl({ error: 'access_denied', errorDescription: 'User denied' }),
    )

    await expect(launchYandexAuth()).rejects.toMatchObject({
      message: expect.stringContaining('OAuth'),
    })
  })

  it('launchYandexAuth: отклоняет токен без cloud_api:disk.write', async () => {
    launchWebAuthFlow.mockResolvedValueOnce(buildOAuthRedirectUrl({ scope: 'login:avatar' }))

    await expect(launchYandexAuth()).rejects.toMatchObject({
      message: expect.stringContaining('disk.write'),
    })
  })

  it('launchYandexAuth: обрабатывает отмену пользователем', async () => {
    launchWebAuthFlow.mockResolvedValueOnce(undefined as unknown as string)

    await expect(launchYandexAuth({ interactive: true })).rejects.toMatchObject({
      message: 'Авторизация отменена',
    })
  })
})
