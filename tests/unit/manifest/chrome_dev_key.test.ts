/**
 * Ключ dev-сборки Chrome и id расширения.
 *
 * Chrome выводит id как SHA-256 от публичного ключа из манифеста: первые 16
 * байт хеша, каждая тетрада — буква `a`–`p`. От этого id зависит redirect URI
 * OAuth (`https://<id>.chromiumapp.org/`), зарегистрированный в oauth.yandex.ru.
 * Если ключ и зарегистрированный URI разойдутся, вход в dev-сборке перестанет
 * работать молча — с ошибкой «redirect_uri не совпадает».
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CHROME_DEV_EXTENSION_KEY, chromeDevManifestKey } from '@/lib/manifest/chrome_dev_key'

const CHROME_DEV_EXTENSION_ID = 'pfmakliblbchbbjplplmkdhgbofmamdm'

/** id расширения Chrome из публичного ключа CRX (base64 DER). */
const extensionIdFromKey = (key: string): string =>
  createHash('sha256')
    .update(Buffer.from(key, 'base64'))
    .digest('hex')
    .slice(0, 32)
    .replace(/./g, (digit) => String.fromCharCode(97 + Number.parseInt(digit, 16)))

describe('ключ dev-сборки Chrome', () => {
  it('даёт зарегистрированный id расширения', () => {
    expect(extensionIdFromKey(CHROME_DEV_EXTENSION_KEY)).toBe(CHROME_DEV_EXTENSION_ID)
  })

  it('остаётся публичным ключом, а не закрытым', () => {
    // DER SubjectPublicKeyInfo: SEQUENCE → AlgorithmIdentifier → BIT STRING.
    const der = Buffer.from(CHROME_DEV_EXTENSION_KEY, 'base64')
    expect(der[0]).toBe(0x30)
    expect(der.subarray(1, 20).toString('hex')).toContain('300d06092a864886f70d010101')
  })
})

describe('поле key в манифесте', () => {
  it('есть в dev-сборке Chrome', () => {
    expect(chromeDevManifestKey('chrome', 'serve')).toEqual({ key: CHROME_DEV_EXTENSION_KEY })
  })

  it('не попадает в релизную сборку', () => {
    expect(chromeDevManifestKey('chrome', 'build')).toEqual({})
  })

  it('не попадает в сборку Firefox', () => {
    expect(chromeDevManifestKey('firefox', 'serve')).toEqual({})
  })
})
