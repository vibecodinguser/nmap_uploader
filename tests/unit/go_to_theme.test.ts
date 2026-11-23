import { describe, expect, it } from 'vitest'
import { resolveGoToThemeColors } from '@/lib/go_to_theme'

describe('resolveGoToThemeColors', () => {
  it('возвращает светлую палитру', () => {
    expect(resolveGoToThemeColors('light')).toEqual({
      background: '#ffffff',
      color: '#000000',
      hoverBackground: '#f2f2f2',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    })
  })

  it('возвращает тёмную палитру редактора', () => {
    expect(resolveGoToThemeColors('dark')).toEqual({
      background: '#333333',
      color: '#bfbfbf',
      hoverBackground: '#4d4d4d',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
    })
  })

  it('не зависит от браузера: фон один и тот же', () => {
    // Было расхождение Chrome #45464f / Firefox #333333 — фон обязан совпадать.
    expect(resolveGoToThemeColors('dark').background).toBe('#333333')
  })
})
