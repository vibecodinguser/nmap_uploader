import { describe, expect, it } from 'vitest'
import { withNativeLocaleParam } from '@/lib/locale_bridge'

describe('withNativeLocaleParam', () => {
  it('appends the locale to a bare url', () => {
    expect(withNativeLocaleParam('chrome-extension://id/panel.html', 'en')).toBe(
      'chrome-extension://id/panel.html?nativeLocale=en',
    )
  })

  it('keeps existing query parameters', () => {
    expect(withNativeLocaleParam('chrome-extension://id/panel.html?nativeTheme=dark', 'ru')).toBe(
      'chrome-extension://id/panel.html?nativeTheme=dark&nativeLocale=ru',
    )
  })

  it('keeps the hash at the end', () => {
    expect(withNativeLocaleParam('chrome-extension://id/panel.html#settings', 'en')).toBe(
      'chrome-extension://id/panel.html?nativeLocale=en#settings',
    )
  })
})
