import { describe, expect, it } from 'vitest'
import { resolveGoToThemeColors } from '@/lib/go_to_theme'

describe('resolveGoToThemeColors', () => {
  it('возвращает светлую палитру', () => {
    expect(resolveGoToThemeColors('light')).toEqual({
      background: '#ffffff',
      color: '#000000',
      hoverBackground: '#ffeba0',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    })
  })

  it('возвращает тёмную палитру Chrome', () => {
    expect(resolveGoToThemeColors('dark', { isFirefox: false })).toEqual({
      background: '#45464f',
      color: '#ededed',
      hoverBackground: '#4d4d4d',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
    })
  })

  it('в Firefox использует фон #333333', () => {
    expect(resolveGoToThemeColors('dark', { isFirefox: true })).toEqual({
      background: '#333333',
      color: '#ededed',
      hoverBackground: '#4d4d4d',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
    })
  })
})
