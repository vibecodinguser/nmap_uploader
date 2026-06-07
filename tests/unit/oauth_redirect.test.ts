import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRedirectURL } from '@/tests/setup/browser_mock'
import { getOAuthRedirectUri } from '@/lib/yandex/oauth_redirect'

describe('getOAuthRedirectUri', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('возвращает URI браузера без override', () => {
    expect(getOAuthRedirectUri()).toBe(getRedirectURL())
  })

  it('использует YANDEX_REDIRECT_URI из env', () => {
    vi.stubEnv('YANDEX_REDIRECT_URI', 'https://example.chromiumapp.org/')
    expect(getOAuthRedirectUri()).toBe('https://example.chromiumapp.org/')
  })

  it('игнорирует пустой YANDEX_REDIRECT_URI', () => {
    vi.stubEnv('YANDEX_REDIRECT_URI', '   ')
    expect(getOAuthRedirectUri()).toBe(getRedirectURL())
  })
})
