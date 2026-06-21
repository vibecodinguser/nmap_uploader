import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { createTranslator, getStoredLocale } from '@/lib/i18n'
import { LOCALE_OPTIONS, LOCALE_STORAGE_KEY, localeFromUiLanguage } from '@/lib/i18n/locale'
import type { LocaleOption } from '@/lib/i18n/locale.types'
import { enMessages } from '@/lib/i18n/messages/en'
import { ruMessages } from '@/lib/i18n/messages/ru'
import type { Messages } from '@/lib/i18n/messages/types'
import { resetBrowserMocks } from '../setup/browser_mock'

const assertMessagesShape = (messages: Messages): Messages => messages
assertMessagesShape(ruMessages)
assertMessagesShape(enMessages)

const assertLocaleOptions = (options: readonly LocaleOption[]): readonly LocaleOption[] => options
assertLocaleOptions(LOCALE_OPTIONS)

describe('i18n', () => {
  it('returns Russian messages by default', () => {
    const t = createTranslator('ru')
    expect(t('tabs.polygons')).toBe('Полигоны')
  })

  it('returns English messages', () => {
    const t = createTranslator('en')
    expect(t('tabs.polygons')).toBe('Polygons')
    expect(t('settings.title')).toBe('Settings')
  })

  it('interpolates parameters', () => {
    const t = createTranslator('en')
    expect(t('settings.activeCount', { active: 2, total: 5 })).toBe('2 of 5 active')
  })

  describe('localeFromUiLanguage', () => {
    it('maps Russian browser UI languages to ru', () => {
      expect(localeFromUiLanguage('ru')).toBe('ru')
      expect(localeFromUiLanguage('ru-RU')).toBe('ru')
    })

    it('maps other browser UI languages to en', () => {
      expect(localeFromUiLanguage('en')).toBe('en')
      expect(localeFromUiLanguage('en-US')).toBe('en')
      expect(localeFromUiLanguage('de')).toBe('en')
    })
  })

  describe('getStoredLocale', () => {
    beforeEach(async () => {
      await resetBrowserMocks()
    })

    it('returns stored locale when present', async () => {
      await browser.storage.local.set({ [LOCALE_STORAGE_KEY]: 'en' })

      await expect(getStoredLocale()).resolves.toBe('en')
    })

    it('detects locale from browser UI language on first run and persists it', async () => {
      vi.spyOn(browser.i18n, 'getUILanguage').mockReturnValue('en-US')

      await expect(getStoredLocale()).resolves.toBe('en')
      await expect(browser.storage.local.get(LOCALE_STORAGE_KEY)).resolves.toEqual({
        [LOCALE_STORAGE_KEY]: 'en',
      })
    })
  })
})
