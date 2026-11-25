import { describe, expect, it } from 'vitest'
import { createTranslator } from '@/lib/i18n'
import { DEFAULT_LOCALE, isLocale, localeFromUiLanguage } from '@/lib/i18n/locale'
import { enMessages } from '@/lib/i18n/messages/en'
import { ruMessages } from '@/lib/i18n/messages/ru'
import type { Messages } from '@/lib/i18n/messages/types'

const assertMessagesShape = (messages: Messages): Messages => messages
assertMessagesShape(ruMessages)
assertMessagesShape(enMessages)

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

  it('uses Russian as the fallback locale', () => {
    expect(DEFAULT_LOCALE).toBe('ru')
  })

  it('recognizes only supported locales', () => {
    expect(isLocale('ru')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
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
      expect(localeFromUiLanguage('uk')).toBe('en')
    })
  })
})
