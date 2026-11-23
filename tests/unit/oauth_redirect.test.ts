import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIREFOX_EXTENSION_ID } from '@/lib/firefox_extension_id'
import {
  FIREFOX_OAUTH_REDIRECT_URI,
  getOAuthRedirectUri,
  sha1Hex,
} from '@/lib/yandex/oauth_redirect'
import { getRedirectURL } from '@/tests/setup/browser_mock'

const nodeSha1 = (value: string): string => createHash('sha1').update(value).digest('hex')

describe('sha1Hex', () => {
  it('совпадает с node:crypto на пустой строке', () => {
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
  })

  it('совпадает с node:crypto на разных длинах и алфавитах', () => {
    const cases = ['abc', 'yamapper@local.dev', 'a'.repeat(100), 'Привет, мир']
    for (const value of cases) {
      expect(sha1Hex(value)).toBe(nodeSha1(value))
    }
  })
})

describe('FIREFOX_OAUTH_REDIRECT_URI', () => {
  it('вычисляется из gecko.id, а не хранится отдельно', () => {
    // Регрессия: хеш был захардкожен и разошёлся с FIREFOX_EXTENSION_ID после
    // переименования, из-за чего Firefox получал «redirect_uri не совпадает».
    expect(FIREFOX_OAUTH_REDIRECT_URI).toBe(
      `https://${nodeSha1(FIREFOX_EXTENSION_ID)}.extensions.allizom.org/`,
    )
  })

  it('остаётся тем адресом, что зарегистрирован в oauth.yandex.ru', () => {
    // Callback URL в приложении Яндекса привязан к gecko.id nmap-uploader.
    // Смена этой строки ломает вход в Firefox — менять только вместе с
    // регистрацией нового Callback URL.
    expect(FIREFOX_OAUTH_REDIRECT_URI).toBe(
      'https://4a5e412e7f9b878927b1bedbfad1a6905cb32415.extensions.allizom.org/',
    )
  })
})

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
})
