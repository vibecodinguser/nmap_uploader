import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIREFOX_OAUTH_REDIRECT_URI, getOAuthRedirectUri } from '@/lib/yandex/oauth_redirect'
import { getRedirectURL } from '@/tests/setup/browser_mock'

describe('getOAuthRedirectUri', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('возвращает URI браузера без override', () => {
    expect(getOAuthRedirectUri()).toBe(getRedirectURL())
  })

  it('игнорирует YANDEX_REDIRECT_URI, не совпадающий с getRedirectURL()', () => {
    vi.stubEnv(
      'YANDEX_REDIRECT_URI',
      'http://127.0.0.1/mozoauth2/4a5e412e7f9b878927b1bedbfad1a6905cb32415',
    )
    expect(getOAuthRedirectUri()).toBe(getRedirectURL())
  })

  it('игнорирует пустой YANDEX_REDIRECT_URI', () => {
    vi.stubEnv('YANDEX_REDIRECT_URI', '   ')
    expect(getOAuthRedirectUri()).toBe(getRedirectURL())
  })

  it('экспортирует ожидаемый Firefox redirect URI для oauth.yandex.ru', () => {
    expect(FIREFOX_OAUTH_REDIRECT_URI).toBe(
      'https://4a5e412e7f9b878927b1bedbfad1a6905cb32415.extensions.allizom.org/',
    )
  })
})
