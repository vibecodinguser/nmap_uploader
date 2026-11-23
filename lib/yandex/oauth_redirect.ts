import { browser } from 'wxt/browser'
import { FIREFOX_EXTENSION_ID } from '@/lib/firefox_extension_id'

/**
 * SHA1 в hex от gecko.id — так Firefox строит redirect URI для OAuth:
 * `https://<sha1(gecko.id)>.extensions.allizom.org/`.
 *
 * Считаем сами, а не храним строку: захардкоженный хеш молча разъезжался с
 * `FIREFOX_EXTENSION_ID` при переименовании, и авторизация в Firefox падала
 * с «redirect_uri не совпадает с Callback URL».
 *
 * @see https://searchfox.org/mozilla-central/source/toolkit/components/extensions/child/ext-identity.js
 */
export const sha1Hex = (value: string): string => {
  const message = new TextEncoder().encode(value)
  const bitLength = message.length * 8
  const paddedLength = (((message.length + 8) >> 6) + 1) * 64
  const buffer = new Uint8Array(paddedLength)
  buffer.set(message)
  buffer[message.length] = 0x80

  const view = new DataView(buffer.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n))

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const w = new Array<number>(80)
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4)
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1)
    }

    let [a, b, c, d, e] = h
    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0
      e = d
      d = c
      c = rotl(b, 30) >>> 0
      b = a
      a = temp
    }

    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
  }

  return h.map((word) => word.toString(16).padStart(8, '0')).join('')
}

/**
 * Redirect URI Firefox для oauth.yandex.ru. Вычисляется из
 * `FIREFOX_EXTENSION_ID`, поэтому не может разъехаться с gecko.id.
 * launchWebAuthFlow перехватывает его без реального HTTP-запроса
 * (в отличие от 127.0.0.1/mozoauth2).
 */
export const FIREFOX_OAUTH_REDIRECT_URI = `https://${sha1Hex(FIREFOX_EXTENSION_ID)}.extensions.allizom.org/`

const normalizeRedirectUri = (uri: string): string => uri.replace(/\/?$/, '/')

/** Redirect URI для OAuth — всегда browser.identity.getRedirectURL(). */
export const getOAuthRedirectUri = (): string => {
  const browserRedirect = browser.identity.getRedirectURL()
  const override = import.meta.env.YANDEX_REDIRECT_URI?.trim()

  if (override && normalizeRedirectUri(override) !== normalizeRedirectUri(browserRedirect)) {
    console.warn(
      `[yamapper] YANDEX_REDIRECT_URI (${override}) не совпадает с browser.identity.getRedirectURL() (${browserRedirect}). ` +
        `Зарегистрируйте в oauth.yandex.ru: ${browserRedirect}`,
    )
  }

  return browserRedirect
}
