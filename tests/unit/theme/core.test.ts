import { describe, expect, it } from 'vitest'
import { normalizeThemeMode, resolveTheme } from '@/lib/theme/core'

describe('Theme Core (TDD slice: pure theme resolution)', () => {
  it('нормализует допустимые режимы темы', () => {
    expect(normalizeThemeMode('light')).toBe('light')
    expect(normalizeThemeMode('dark')).toBe('dark')
    expect(normalizeThemeMode('system')).toBe('system')
  })

  it('возвращает "system" для любых неизвестных или пустых значений', () => {
    expect(normalizeThemeMode(null)).toBe('system')
    expect(normalizeThemeMode(undefined)).toBe('system')
    expect(normalizeThemeMode('invalid')).toBe('system')
    expect(normalizeThemeMode('')).toBe('system')
  })

  it('разрешает тему "light" или "dark" напрямую', () => {
    expect(resolveTheme({ mode: 'light', isSystemDark: true })).toBe('light')
    expect(resolveTheme({ mode: 'dark', isSystemDark: false })).toBe('dark')
  })

  it('разрешает тему "system" на основе системных предпочтений пользователя', () => {
    expect(resolveTheme({ mode: 'system', isSystemDark: true })).toBe('dark')
    expect(resolveTheme({ mode: 'system', isSystemDark: false })).toBe('light')
  })
})
