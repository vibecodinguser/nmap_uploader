import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTranslator } from '@/lib/i18n'
import { DEFAULT_LOCALE, isLocale, localeFromUiLanguage } from '@/lib/i18n/locale'
import { enMessages } from '@/lib/i18n/messages/en'
import { ruMessages } from '@/lib/i18n/messages/ru'
import type { Messages } from '@/lib/i18n/messages/types'

const assertMessagesShape = (messages: Messages): Messages => messages
assertMessagesShape(ruMessages)
assertMessagesShape(enMessages)

/*
 * Ключи, которые код читает динамически, а не литералом:
 * имена геосервисов приходят из `go_to` и читаются `getGoToSourceDisplayName`.
 */
const DYNAMIC_KEYS = new Set(['goToSources.Rosreestr', 'goToSources.Etomesto'])

const ROOT = resolve(import.meta.dirname, '../..')
const SOURCE_DIRS = ['lib', 'components', 'hooks', 'entrypoints']

const sourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (path.endsWith(join('lib', 'i18n', 'messages'))) continue
      files.push(...sourceFiles(path))
      continue
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(path)
  }
  return files
}

const flattenKeys = (value: object, prefix = ''): string[] => {
  const keys: string[] = []
  for (const [name, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${name}` : name
    if (typeof child === 'object' && child !== null) keys.push(...flattenKeys(child, path))
    else keys.push(path)
  }
  return keys
}

describe('i18n', () => {
  it('returns Russian messages by default', () => {
    const t = createTranslator('ru')
    expect(t('upload.chooseFile')).toBe('Выбрать файл')
  })

  it('returns English messages', () => {
    const t = createTranslator('en')
    expect(t('upload.chooseFile')).toBe('Choose file')
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

  describe('мёртвые ключи', () => {
    it('не содержит ключей, которые никто не читает', () => {
      const source = SOURCE_DIRS.flatMap((directory) => sourceFiles(join(ROOT, directory)))
        .map((file) => readFileSync(file, 'utf8'))
        .join('\n')

      const unused = flattenKeys(ruMessages).filter(
        (key) => !DYNAMIC_KEYS.has(key) && !source.includes(key),
      )

      expect(unused).toEqual([])
    })

    it('в en и ru одинаковый набор ключей', () => {
      expect(flattenKeys(enMessages).sort()).toEqual(flattenKeys(ruMessages).sort())
    })
  })
})
