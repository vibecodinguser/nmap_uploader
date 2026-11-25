// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { initNativeLocaleBridge, observeLocale } from '@/lib/locale_bootstrap'
import { NATIVE_LOCALE_MESSAGE } from '@/lib/locale_bridge'
import { getNativeLocaleSnapshot, setNativeLocale } from '@/lib/native_locale'

const postFromParent = (data: unknown): void => {
  window.dispatchEvent(new MessageEvent('message', { data, source: window.parent }))
}

describe('locale_bootstrap', () => {
  afterEach(() => {
    setNativeLocale('ru')
    vi.restoreAllMocks()
  })

  it('reads the initial locale from the iframe url', () => {
    window.history.replaceState(null, '', '/panel.html?nativeLocale=en')

    initNativeLocaleBridge()

    expect(getNativeLocaleSnapshot()).toBe('en')
    window.history.replaceState(null, '', '/')
  })

  it('applies a locale message from the host page', () => {
    initNativeLocaleBridge()

    postFromParent({ action: NATIVE_LOCALE_MESSAGE, locale: 'en' })

    expect(getNativeLocaleSnapshot()).toBe('en')
  })

  it('ignores messages that are not about the locale', () => {
    initNativeLocaleBridge()

    postFromParent({ action: NATIVE_LOCALE_MESSAGE, locale: 'de' })
    postFromParent({ action: 'SOMETHING_ELSE', locale: 'en' })

    expect(getNativeLocaleSnapshot()).toBe('ru')
  })

  it('emits the current locale and follows changes', () => {
    const onChange = vi.fn()
    const stop = observeLocale(onChange)

    expect(onChange).toHaveBeenCalledWith('ru')

    setNativeLocale('en')
    expect(onChange).toHaveBeenLastCalledWith('en')

    stop()
  })
})
