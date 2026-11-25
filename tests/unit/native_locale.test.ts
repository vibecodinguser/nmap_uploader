// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCALE } from '@/lib/i18n/locale'
import {
  getNativeLocaleSnapshot,
  observeNativeLocale,
  readNativeLocale,
  setNativeLocale,
  subscribeNativeLocale,
  toNativeLocale,
} from '@/lib/native_locale'

describe('native locale', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru'
    setNativeLocale(DEFAULT_LOCALE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('readNativeLocale', () => {
    it('maps the editor page lang to a locale', () => {
      document.documentElement.lang = 'ru'
      expect(readNativeLocale()).toBe('ru')

      document.documentElement.lang = 'en'
      expect(readNativeLocale()).toBe('en')
    })

    it('treats every non-Russian editor language as English', () => {
      document.documentElement.lang = 'uk'
      expect(readNativeLocale()).toBe('en')
    })

    it('falls back to the browser language when lang is empty', () => {
      document.documentElement.lang = ''
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB')
      expect(readNativeLocale()).toBe('en')
    })
  })

  describe('observeNativeLocale', () => {
    it('does not emit without a real change', () => {
      const onChange = vi.fn()

      const stop = observeNativeLocale(onChange)

      expect(onChange).not.toHaveBeenCalled()
      stop()
    })

    it('reports a locale change without waiting for a reload', async () => {
      const onChange = vi.fn()
      const stop = observeNativeLocale(onChange)
      onChange.mockClear()

      document.documentElement.lang = 'en'

      await vi.waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('en')
      })
      stop()
    })

    it('stops reporting after cleanup', async () => {
      const onChange = vi.fn()
      const stop = observeNativeLocale(onChange)
      stop()
      onChange.mockClear()

      document.documentElement.lang = 'en'

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('native locale store', () => {
    it('starts with the default locale', () => {
      expect(getNativeLocaleSnapshot()).toBe(DEFAULT_LOCALE)
    })

    it('notifies subscribers only on a real change', () => {
      const listener = vi.fn()
      const unsubscribe = subscribeNativeLocale(listener)

      setNativeLocale('ru')
      expect(listener).not.toHaveBeenCalled()

      setNativeLocale('en')
      expect(listener).toHaveBeenCalledWith('en')

      unsubscribe()
      setNativeLocale('ru')
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('toNativeLocale', () => {
    it('accepts supported locales and rejects anything else', () => {
      expect(toNativeLocale('en')).toBe('en')
      expect(toNativeLocale('ru')).toBe('ru')
      expect(toNativeLocale('de')).toBeNull()
      expect(toNativeLocale(null)).toBeNull()
    })
  })
})
