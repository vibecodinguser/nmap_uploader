import { describe, expect, it } from 'vitest'
import { createTranslator } from '@/lib/i18n'

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
})
