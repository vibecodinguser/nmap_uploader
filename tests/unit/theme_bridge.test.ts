import { describe, expect, it } from 'vitest'
import { withNativeThemeParam } from '@/lib/theme_bridge'

describe('withNativeThemeParam', () => {
  it('добавляет тему к обычному URL расширения', () => {
    expect(withNativeThemeParam('chrome-extension://id/panel.html', 'dark')).toBe(
      'chrome-extension://id/panel.html?nativeTheme=dark',
    )
  })

  it('сохраняет существующие параметры', () => {
    expect(withNativeThemeParam('chrome-extension://id/panel.html?tab=notes', 'light')).toBe(
      'chrome-extension://id/panel.html?tab=notes&nativeTheme=light',
    )
  })

  it('не трогает hash', () => {
    expect(withNativeThemeParam('chrome-extension://id/panel.html#settings', 'dark')).toBe(
      'chrome-extension://id/panel.html?nativeTheme=dark#settings',
    )
  })
})
